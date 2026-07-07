import { prisma } from "@/lib/prisma"
import { format, formatDistanceToNow, addDays } from "date-fns"
import { Tag, AlertTriangle, TrendingDown, Clock } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

type CreditStatus = "pending" | "scheduled" | "active" | "completed" | "cancelled" | "expired"
type CreditType   = "percentage_off" | "fixed_amount" | "free_billing_cycles" | "free_addon" | "free_intelligence_module" | "free_employee_band" | "free_location"

const STATUS_COLORS: Record<CreditStatus, string> = {
  active:    "bg-green-900/40 text-green-300",
  scheduled: "bg-blue-900/40 text-blue-300",
  pending:   "bg-yellow-900/40 text-yellow-300",
  completed: "bg-gray-800 text-gray-400",
  cancelled: "bg-gray-800 text-gray-400",
  expired:   "bg-red-900/20 text-red-400",
}

function describeCredit(type: CreditType, value: number): string {
  switch (type) {
    case "percentage_off":           return `${value}% off`
    case "fixed_amount":             return `$${value}/mo off`
    case "free_billing_cycles":      return `${value} free cycle${value !== 1 ? "s" : ""}`
    case "free_addon":               return "Free add-on"
    case "free_intelligence_module": return "Free module"
    case "free_employee_band":       return "Free band"
    case "free_location":            return "Free location"
  }
}

export default async function PromotionsDashboardPage() {
  const now   = new Date()
  const in30d = addDays(now, 30)

  const [activeCredits, expiringCredits, pendingReferrals, stats] = await Promise.all([
    prisma.billingCredit.findMany({
      where:   { status: "active" },
      include: { org: { select: { id: true, name: true, monthlyTotalBeforeDiscount: true } } },
      orderBy: { effectiveDate: "desc" },
    }),
    prisma.billingCredit.findMany({
      where: { status: "active", durationUntilDate: { lte: in30d, gte: now } },
      include: { org: { select: { id: true, name: true } } },
      orderBy: { durationUntilDate: "asc" },
    }),
    prisma.referral.findMany({
      where: { rewardStatus: { in: ["pending", "qualifying"] } },
      include: {
        referrerOrg: { select: { id: true, name: true } },
        referredOrg: { select: { id: true, name: true, subscriptionStatus: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    Promise.all([
      prisma.billingCredit.count({ where: { status: "active" } }),
      prisma.billingCredit.count({ where: { status: { in: ["scheduled", "pending"] } } }),
      prisma.referral.count({ where: { rewardStatus: { in: ["pending", "qualifying"] } } }),
    ]),
  ])

  const [activeCount, pendingCount, pendingRefCount] = stats

  // MRR impact
  let mrrImpact = 0
  for (const c of activeCredits) {
    const base = c.org.monthlyTotalBeforeDiscount ?? 0
    if (c.creditType === "percentage_off") mrrImpact += base * (c.discountValue / 100)
    else if (c.creditType === "fixed_amount") mrrImpact += c.discountValue
    else if (["free_billing_cycles", "free_addon", "free_intelligence_module",
               "free_employee_band", "free_location"].includes(c.creditType)) mrrImpact += base
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Tag className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Promotions Dashboard</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Credits",     value: activeCount,                  icon: Tag,           color: "text-green-400" },
          { label: "Pending / Scheduled",value: pendingCount,                 icon: Clock,         color: "text-yellow-400" },
          { label: "Open Referrals",     value: pendingRefCount,              icon: AlertTriangle, color: "text-blue-400" },
          { label: "MRR Impact",         value: `$${mrrImpact.toFixed(0)}/mo`, icon: TrendingDown,  color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Credits */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" /> Active Credits
          </h2>
          {activeCredits.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">No active credits.</p>
          ) : (
            <div className="space-y-2">
              {activeCredits.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-800 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/super-admin/organizations/${c.org.id}`}
                      className="text-sm text-white font-medium hover:text-indigo-300 transition-colors truncate block">
                      {c.org.name}
                    </Link>
                    <p className="text-xs text-indigo-300 mt-0.5">{c.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{describeCredit(c.creditType as CreditType, c.discountValue)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status as CreditStatus]}`}>
                      {c.status}
                    </span>
                    {c.effectiveDate && (
                      <p className="text-xs text-gray-600 mt-1">{format(c.effectiveDate, "MMM d, yyyy")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Expiring Soon */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Expiring in 30 Days
            </h2>
            {expiringCredits.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">None expiring soon.</p>
            ) : (
              <div className="space-y-2">
                {expiringCredits.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0">
                    <div className="min-w-0">
                      <Link href={`/super-admin/organizations/${c.org.id}`}
                        className="text-sm text-white hover:text-indigo-300 transition-colors truncate block">
                        {c.org.name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>
                    </div>
                    <p className="text-xs text-red-400 shrink-0">
                      {c.durationUntilDate ? formatDistanceToNow(c.durationUntilDate, { addSuffix: true }) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Referrals */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" /> Qualifying Referrals
            </h2>
            {pendingReferrals.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">No open referrals.</p>
            ) : (
              <div className="space-y-2">
                {pendingReferrals.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0">
                    <div className="min-w-0 text-xs">
                      <span className="text-white">{r.referrerOrg.name}</span>
                      <span className="text-gray-500"> → </span>
                      <span className="text-gray-300">{r.referredOrg.name}</span>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.rewardStatus === "qualifying" ? "bg-blue-900/40 text-blue-300" : "bg-yellow-900/40 text-yellow-300"
                    }`}>
                      {r.rewardStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
