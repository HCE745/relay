import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getActiveReferralProgram } from "@/lib/billing-credits-engine"
import { ReferralShareSection } from "@/components/referrals/referral-share-section"
import { format } from "date-fns"
import { Gift, CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<string, string> = {
  "Reward Applied":           "bg-green-100 text-green-800 border-green-200",
  "Rewards Scheduled":        "bg-teal-100 text-teal-800 border-teal-200",
  "Qualified":                "bg-green-50 text-green-700 border-green-100",
  "Qualification In Progress":"bg-blue-100 text-blue-800 border-blue-200",
  "Qualification Paused":     "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Paid":                     "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Trial Active":              "bg-purple-100 text-purple-800 border-purple-200",
  "Signup Started":            "bg-gray-100 text-gray-700 border-gray-200",
  "Disqualified":              "bg-red-100 text-red-700 border-red-200",
  "Cancelled":                 "bg-gray-100 text-gray-500 border-gray-200",
}

function fmt(d: Date | null | undefined) {
  return d ? format(new Date(d), "MMM d, yyyy") : "—"
}

export default async function ReferralsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const orgId = session.organizationId
  const canView = ["ADMIN", "MANAGER"].includes(session.role)
  if (!canView) redirect("/dashboard")

  const [org, program, referrals, creditStats] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { referralCode: true, referralLink: true },
    }),
    getActiveReferralProgram(),
    prisma.referral.findMany({
      where: { referrerOrgId: orgId },
      include: {
        referredOrg: {
          select: { id: true, name: true, subscriptionStatus: true, createdAt: true },
        },
        referrerCredit: { select: { id: true, status: true, description: true, effectiveDate: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.billingCredit.aggregate({
      where: {
        orgId,
        reason: { contains: "Referral" },
        status: { in: ["active", "completed"] },
      },
      _sum: { discountValue: true },
    }),
  ])

  // Derive display status for each referral
  const rows = referrals.map(r => {
    const monthsPaid = r.consecutiveMonthsPaid
    const monthsReq  = r.qualificationMonthsRequired

    let displayStatus: string
    if (r.rewardStatus === "disqualified") {
      displayStatus = "Disqualified"
    } else if (r.rewardStatus === "cancelled") {
      displayStatus = "Cancelled"
    } else if (r.rewardStatus === "rewarded") {
      const cs = r.referrerCredit?.status
      displayStatus = (cs === "active" || cs === "completed") ? "Reward Applied" : "Rewards Scheduled"
    } else if (r.rewardStatus === "paused") {
      displayStatus = "Qualification Paused"
    } else if (r.rewardStatus === "qualifying" && monthsPaid > 0) {
      displayStatus = "Qualification In Progress"
    } else if (r.firstPaymentDate || r.referredOrg.subscriptionStatus === "active") {
      displayStatus = "Paid"
    } else if (r.referredOrg.subscriptionStatus === "trialing") {
      displayStatus = "Trial Active"
    } else {
      displayStatus = "Signup Started"
    }

    return { ...r, displayStatus, monthsPaid, monthsReq }
  })

  const stats = {
    submitted:    rows.length,
    qualified:    rows.filter(r => ["rewarded"].includes(r.rewardStatus) || r.qualifiedAt).length,
    pending:      rows.filter(r => ["pending", "qualifying", "paused"].includes(r.rewardStatus)).length,
    creditsEarned: Math.round(creditStats._sum.discountValue ?? 0),
  }

  const referralLink = org?.referralLink ?? `https://app.getrelay.software/signup?ref=${org?.referralCode}`

  return (
    <div>
      <Header title="Referrals" />

      <div className="px-3 md:px-6 py-4 md:py-6 space-y-6 max-w-5xl">

        {/* Hero / share section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {program?.cardTitle ?? "Earn Free Months"}
                </h2>
                {program?.cardDescription && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{program.cardDescription}</p>
                )}
              </div>
            </div>

            {program?.programDescription && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{program.programDescription}</p>
            )}

            {/* Share section — client component for copy/email interactivity */}
            {org?.referralCode && (
              <ReferralShareSection referralLink={referralLink} ctaLabel={program?.ctaLabel ?? "Copy Referral Link"} />
            )}

            {program?.qualificationExplanation && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {program.qualificationExplanation}
              </p>
            )}

            {program?.termsText && (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{program.termsText}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Submitted",       value: stats.submitted,    icon: TrendingUp,   color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-900/20" },
            { label: "Qualified",        value: stats.qualified,    icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
            { label: "In Progress",      value: stats.pending,      icon: Clock,        color: "text-yellow-600",bg: "bg-yellow-50 dark:bg-yellow-900/20" },
            { label: "Credits Earned",   value: stats.creditsEarned > 0 ? `$${stats.creditsEarned}` : "—", icon: Gift, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Referral history table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Referral History</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {rows.length === 0 ? "No referrals yet — share your link to get started." : `${rows.length} referral${rows.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No referrals yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Share your link above to invite others and earn rewards.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Organisation</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Signed Up</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">First Payment</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Progress</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Qualified</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {rows.map(row => {
                    const progressLabel = row.monthsReq > 0 && row.monthsPaid > 0
                      ? `Month ${Math.min(row.monthsPaid, row.monthsReq)} of ${row.monthsReq}`
                      : row.rewardStatus === "rewarded" ? "Complete" : "—"
                    const progressPct = row.monthsReq > 0
                      ? Math.min(100, Math.round((row.monthsPaid / row.monthsReq) * 100))
                      : row.rewardStatus === "rewarded" ? 100 : 0

                    return (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900 dark:text-white">{row.referredOrg.name}</span>
                        </td>
                        <td className="px-4 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {fmt(row.signupDate)}
                        </td>
                        <td className="px-4 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {fmt(row.firstPaymentDate)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[120px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{progressLabel}</span>
                              {progressPct > 0 && progressPct < 100 && (
                                <span className="text-xs text-gray-400">{progressPct}%</span>
                              )}
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${progressPct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {fmt(row.qualifiedAt)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[row.displayStatus] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {row.displayStatus}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
