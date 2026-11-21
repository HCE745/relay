import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { PackageCheck, ArrowLeft, Clock, CheckCircle2, XCircle, Ban } from "lucide-react"

export const dynamic = "force-dynamic"

const HANDOFF_STATUS: Record<string, { label: string; color: string }> = {
  pending_review: { label: "In Review",  color: "bg-yellow-900/40 text-yellow-300 border-yellow-700/50" },
  accepted:       { label: "Accepted",   color: "bg-green-900/40 text-green-300 border-green-700/50" },
  rejected:       { label: "Rejected",   color: "bg-red-900/40 text-red-300 border-red-700/50" },
  cancelled:      { label: "Cancelled",  color: "bg-gray-800 text-gray-500 border-gray-700" },
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending_review: Clock,
  accepted:       CheckCircle2,
  rejected:       XCircle,
  cancelled:      Ban,
}

const DOWNSTREAM_STATUS: Record<string, string> = {
  draft:            "Setting Up",
  configuring:      "Configuring",
  ready_for_review: "Ready for Review",
  ready_to_launch:  "Ready to Launch",
  live:             "Live",
}

export default async function SalesHandoffsPage() {
  const session = await getSession()
  if (!session?.salesUserId && !session?.superAdmin) redirect("/sales/login")

  const isManager = !!(session.superAdmin || session.salesUserRole === "admin_sales")

  const handoffs = await prisma.onboardingHandoff.findMany({
    where: isManager ? {} : { submittedById: session.salesUserId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, companyName: true, isTest: true, status: true, plan: true,
      submittedByName: true, createdAt: true, reviewedAt: true,
      rejectionReason: true, customerOnboardingId: true,
      prospect: { select: { id: true } },
      opportunity: { select: { id: true, title: true } },
    },
  })

  // Enrich accepted handoffs with downstream onboarding status
  const coIds = handoffs.filter(h => h.customerOnboardingId).map(h => h.customerOnboardingId!)
  const onboardings = coIds.length > 0
    ? await prisma.customerOnboarding.findMany({
        where: { id: { in: coIds } },
        select: { id: true, status: true },
      })
    : []
  const coMap = new Map(onboardings.map(o => [o.id, o.status]))

  const pending = handoffs.filter(h => h.status === "pending_review").length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/sales/prospects" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
              Onboarding Requests
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isManager ? "All submitted handoff requests" : "Your submitted handoff requests"}
            </p>
          </div>
          {pending > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500 text-black">
              {pending} pending
            </span>
          )}
        </div>
      </div>

      {handoffs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <PackageCheck className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium mb-1">No onboarding requests yet</p>
          <p className="text-gray-600 text-sm">
            Use the &ldquo;Request Onboarding&rdquo; button on a prospect page to submit a white-glove onboarding request.
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                {isManager && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {handoffs.map(h => {
                const cfg = HANDOFF_STATUS[h.status] ?? { label: h.status, color: "bg-gray-800 text-gray-400 border-gray-700" }
                const StatusIcon = STATUS_ICONS[h.status] ?? Clock
                const downstream = h.customerOnboardingId ? coMap.get(h.customerOnboardingId) : null
                return (
                  <tr key={h.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/sales/prospects/${h.prospect.id}`}
                          className="text-white font-medium hover:text-emerald-400 transition-colors"
                        >
                          {h.companyName}
                        </Link>
                        {h.isTest && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-900/50 text-amber-300 border border-amber-700/60">
                            TEST
                          </span>
                        )}
                      </div>
                      {h.opportunity && (
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[200px]">{h.opportunity.title}</div>
                      )}
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 text-gray-400 text-xs">{h.submittedByName}</td>
                    )}
                    <td className="px-4 py-3 text-gray-400 text-xs capitalize">{h.plan}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded border ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {h.status === "rejected" && h.rejectionReason && (
                        <p className="text-[11px] text-red-400/70 mt-0.5 max-w-[160px] truncate" title={h.rejectionReason}>
                          {h.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {downstream ? (
                        <span className="text-emerald-400">{DOWNSTREAM_STATUS[downstream] ?? downstream}</span>
                      ) : h.status === "accepted" ? (
                        <span className="text-gray-600">Setting up…</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {format(new Date(h.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
