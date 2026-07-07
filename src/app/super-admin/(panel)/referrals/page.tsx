import { prisma } from "@/lib/prisma"
import { format, formatDistanceToNow } from "date-fns"
import { Users, CheckCircle2, Clock, XCircle, Copy } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

type RewardStatus = "pending" | "qualifying" | "qualified" | "rewarded" | "expired" | "cancelled"

const STATUS_COLORS: Record<RewardStatus, string> = {
  pending:    "bg-yellow-900/40 text-yellow-300",
  qualifying: "bg-blue-900/40 text-blue-300",
  qualified:  "bg-indigo-900/40 text-indigo-300",
  rewarded:   "bg-green-900/40 text-green-300",
  expired:    "bg-gray-800 text-gray-400",
  cancelled:  "bg-gray-800 text-gray-400",
}

export default async function ReferralsPage() {
  const [referrals, totalCount, rewardedCount, qualifyingCount] = await Promise.all([
    prisma.referral.findMany({
      include: {
        referrerOrg: { select: { id: true, name: true, referralCode: true, referralLink: true } },
        referredOrg: { select: { id: true, name: true, subscriptionStatus: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.referral.count(),
    prisma.referral.count({ where: { rewardStatus: "rewarded" } }),
    prisma.referral.count({ where: { rewardStatus: { in: ["qualifying", "pending"] } } }),
  ])

  const conversionRate = totalCount > 0 ? ((rewardedCount / totalCount) * 100).toFixed(1) : "0.0"

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Referrals</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Referrals",   value: totalCount,      icon: Users,         color: "text-indigo-400" },
          { label: "Qualifying",        value: qualifyingCount,  icon: Clock,         color: "text-blue-400" },
          { label: "Rewarded",          value: rewardedCount,    icon: CheckCircle2,  color: "text-green-400" },
          { label: "Conversion Rate",   value: `${conversionRate}%`, icon: CheckCircle2, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Referrals table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">All Referrals</h2>
        </div>

        {referrals.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-10">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Referrer", "Referred", "Signed Up", "Months Paid", "Status", "Reward Date", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referrals.map(ref => (
                  <tr key={ref.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/organizations/${ref.referrerOrg.id}`}
                        className="text-sm text-white font-medium hover:text-indigo-300 transition-colors block">
                        {ref.referrerOrg.name}
                      </Link>
                      {ref.referrerOrg.referralCode && (
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-900/20 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          {ref.referrerOrg.referralCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/organizations/${ref.referredOrg.id}`}
                        className="text-sm text-white hover:text-indigo-300 transition-colors block">
                        {ref.referredOrg.name}
                      </Link>
                      <span className="text-[10px] text-gray-500">{ref.referredOrg.subscriptionStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {format(new Date(ref.signupDate), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-white font-semibold">{ref.consecutiveMonthsPaid}</span>
                        <span className="text-xs text-gray-500">/ {ref.qualificationMonthsRequired}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ref.rewardStatus as RewardStatus]}`}>
                        {ref.rewardStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {ref.rewardDate ? format(new Date(ref.rewardDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ReferralActions referralId={ref.id} status={ref.rewardStatus as RewardStatus} />
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

function ReferralActions({ referralId, status }: { referralId: string; status: RewardStatus }) {
  const canQualify = ["pending", "qualifying", "qualified"].includes(status)
  const canCancel  = !["cancelled", "rewarded", "expired"].includes(status)

  if (!canQualify && !canCancel) return <span className="text-gray-600 text-xs">—</span>

  return (
    <div className="flex items-center gap-1.5">
      {canQualify && (
        <form action={`/api/super-admin/referrals/${referralId}`} method="POST">
          <input type="hidden" name="action" value="qualify" />
          <button type="submit"
            className="text-xs px-2 py-1 bg-green-900/40 hover:bg-green-800/60 text-green-300 rounded border border-green-800/40 transition-colors">
            Qualify
          </button>
        </form>
      )}
      {canCancel && (
        <form action={`/api/super-admin/referrals/${referralId}`} method="POST">
          <input type="hidden" name="action" value="cancel" />
          <button type="submit"
            className="text-xs px-2 py-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded border border-red-800/40 transition-colors">
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
