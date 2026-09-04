import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { Users, CheckCircle2, Clock, XCircle, AlertTriangle, Trophy, TrendingUp } from "lucide-react"
import Link from "next/link"
import { SAReferralActions } from "@/components/referrals/sa-referral-actions"

export const dynamic = "force-dynamic"

const STATUS_COLORS: Record<string, string> = {
  pending:      "bg-yellow-900/40 text-yellow-300",
  qualifying:   "bg-blue-900/40 text-blue-300",
  qualified:    "bg-indigo-900/40 text-indigo-300",
  rewarded:     "bg-green-900/40 text-green-300",
  paused:       "bg-orange-900/40 text-orange-300",
  disqualified: "bg-red-900/30 text-red-400",
  cancelled:    "bg-gray-800 text-gray-400",
}

function fmt(d: Date | null | undefined) {
  return d ? format(new Date(d), "MMM d, yyyy") : "—"
}

export default async function ReferralsPage() {
  const [referrals, topReferrers] = await Promise.all([
    prisma.referral.findMany({
      include: {
        referrerOrg:   { select: { id: true, name: true, referralCode: true } },
        referredOrg:   { select: { id: true, name: true, subscriptionStatus: true } },
        referrerCredit: { select: { id: true, status: true, discountValue: true } },
        program:       { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Leaderboard: top referrers by rewarded count
    prisma.referral.groupBy({
      by: ["referrerOrgId"],
      where: { rewardStatus: "rewarded" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ])

  // Enrich leaderboard with org names and credit values
  const leaderboardOrgIds = topReferrers.map(r => r.referrerOrgId)
  const [leaderboardOrgs, leaderboardCredits] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: leaderboardOrgIds } },
      select: { id: true, name: true, referralCode: true },
    }),
    prisma.billingCredit.groupBy({
      by: ["orgId"],
      where: { orgId: { in: leaderboardOrgIds }, reason: { contains: "Referral" }, status: { in: ["active", "completed"] } },
      _sum: { discountValue: true },
    }),
  ])
  const orgMap     = Object.fromEntries(leaderboardOrgs.map(o => [o.id, o]))
  const creditMap  = Object.fromEntries(leaderboardCredits.map(c => [c.orgId, c._sum.discountValue ?? 0]))

  const leaderboard = topReferrers
    .map((r, i) => ({
      rank:       i + 1,
      org:        orgMap[r.referrerOrgId],
      qualified:  r._count.id,
      credits:    creditMap[r.referrerOrgId] ?? 0,
    }))
    .filter(r => r.org)

  // Stats
  const total       = referrals.length
  const rewarded    = referrals.filter(r => r.rewardStatus === "rewarded").length
  const qualifying  = referrals.filter(r => ["pending", "qualifying"].includes(r.rewardStatus)).length
  const disqualified = referrals.filter(r => r.rewardStatus === "disqualified").length
  const fraudFlagged = referrals.filter(r => r.fraudReview).length
  const convRate    = total > 0 ? ((rewarded / total) * 100).toFixed(1) : "0.0"

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Referrals</h1>
        <Link href="/super-admin/referral-program"
          className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 hover:border-indigo-600 px-3 py-1.5 rounded-lg transition-colors">
          Program Settings →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Total",        value: total,        icon: Users,        color: "text-indigo-400" },
          { label: "Qualifying",   value: qualifying,   icon: Clock,        color: "text-blue-400" },
          { label: "Rewarded",     value: rewarded,     icon: CheckCircle2, color: "text-green-400" },
          { label: "Disqualified", value: disqualified, icon: XCircle,      color: "text-red-400" },
          { label: "Fraud Review", value: fraudFlagged, icon: AlertTriangle, color: "text-yellow-400" },
          { label: "Conversion",   value: `${convRate}%`, icon: TrendingUp, color: "text-amber-400" },
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Leaderboard */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Top Referrers</h2>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No rewarded referrals yet.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {leaderboard.map(row => (
                <div key={row.org.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-xs font-bold w-5 text-center ${row.rank === 1 ? "text-amber-400" : row.rank === 2 ? "text-gray-300" : row.rank === 3 ? "text-amber-700" : "text-gray-600"}`}>
                    {row.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/super-admin/organizations/${row.org.id}`}
                      className="text-sm text-white hover:text-indigo-300 transition-colors font-medium truncate block">
                      {row.org.name}
                    </Link>
                    {row.org.referralCode && (
                      <span className="text-[10px] font-mono text-indigo-400">{row.org.referralCode}</span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-green-400">{row.qualified}</div>
                    <div className="text-[10px] text-gray-500">qualified</div>
                  </div>
                  {row.credits > 0 && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-semibold text-amber-400">${Math.round(row.credits)}</div>
                      <div className="text-[10px] text-gray-500">credits</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referral funnel */}
        <div className="xl:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Funnel Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: "Signed up via referral",   count: total,        color: "bg-indigo-600",  pct: 100 },
              { label: "Started paying",           count: referrals.filter(r => r.firstPaymentDate).length, color: "bg-blue-500", pct: total > 0 ? Math.round((referrals.filter(r => r.firstPaymentDate).length / total) * 100) : 0 },
              { label: "Currently qualifying",     count: qualifying,   color: "bg-yellow-500",  pct: total > 0 ? Math.round((qualifying / total) * 100) : 0 },
              { label: "Rewarded",                 count: rewarded,     color: "bg-green-500",   pct: total > 0 ? Math.round((rewarded / total) * 100) : 0 },
            ].map(({ label, count, color, pct }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs text-white font-semibold">{count} <span className="text-gray-500 font-normal">({pct}%)</span></span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full referrals table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">All Referrals ({total})</h2>
        </div>

        {referrals.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-10">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Referrer", "Referred Org", "Program", "Source", "Signed Up", "First Payment", "Months", "Qualified", "Reward Date", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referrals.map(ref => (
                  <tr key={ref.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/organizations/${ref.referrerOrg.id}`}
                        className="text-sm text-white font-medium hover:text-indigo-300 transition-colors block truncate max-w-[140px]">
                        {ref.referrerOrg.name}
                      </Link>
                      {ref.referrerOrg.referralCode && (
                        <span className="text-[10px] font-mono text-indigo-400">{ref.referrerOrg.referralCode}</span>
                      )}
                      {ref.fraudReview && (
                        <span className="ml-1 text-[10px] text-red-400 font-semibold">⚠ FRAUD</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/organizations/${ref.referredOrg.id}`}
                        className="text-sm text-white hover:text-indigo-300 transition-colors block truncate max-w-[140px]">
                        {ref.referredOrg.name}
                      </Link>
                      <span className="text-[10px] text-gray-500">{ref.referredOrg.subscriptionStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[100px] truncate">
                      {ref.program?.name ?? <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 font-mono">{ref.source}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(ref.signupDate)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(ref.firstPaymentDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-white font-semibold">{ref.consecutiveMonthsPaid}</span>
                        <span className="text-xs text-gray-500">/ {ref.qualificationMonthsRequired}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(ref.qualifiedAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(ref.rewardDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[ref.rewardStatus] ?? "bg-gray-800 text-gray-400"}`}>
                        {ref.rewardStatus}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <SAReferralActions
                        referralId={ref.id}
                        status={ref.rewardStatus}
                        fraudReview={ref.fraudReview}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
