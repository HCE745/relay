import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { format } from "date-fns"
import { Building2, CheckCircle2, Clock, AlertCircle, Inbox } from "lucide-react"
import { NewOnboardingButton } from "./new-onboarding-button"

export const dynamic = "force-dynamic"

const ONBOARDING_STATUS: Record<string, { label: string; color: string }> = {
  draft:            { label: "Draft",             color: "bg-gray-800 text-gray-400 border-gray-700" },
  configuring:      { label: "Configuring",       color: "bg-blue-900/50 text-blue-300 border-blue-700" },
  ready_for_review: { label: "Ready for Review",  color: "bg-yellow-900/50 text-yellow-300 border-yellow-700" },
  ready_to_launch:  { label: "Ready to Launch",   color: "bg-indigo-900/50 text-indigo-300 border-indigo-700" },
  live:             { label: "Live",              color: "bg-green-900/50 text-green-300 border-green-700" },
}

const HANDOFF_STATUS: Record<string, { label: string; color: string }> = {
  pending_review: { label: "Pending Review", color: "bg-yellow-900/50 text-yellow-300 border-yellow-700" },
  accepted:       { label: "Accepted",       color: "bg-green-900/50 text-green-300 border-green-700" },
  rejected:       { label: "Rejected",       color: "bg-red-900/50 text-red-300 border-red-700" },
  cancelled:      { label: "Cancelled",      color: "bg-gray-800 text-gray-500 border-gray-700" },
}

function checklistProgress(checklist: unknown): { done: number; total: number } {
  if (!Array.isArray(checklist)) return { done: 0, total: 0 }
  return {
    done:  checklist.filter((i: { completedAt: string | null }) => i.completedAt).length,
    total: checklist.length,
  }
}

type PageProps = { searchParams: Promise<{ tab?: string }> }

export default async function OnboardingListPage({ searchParams }: PageProps) {
  const { tab } = await searchParams
  const activeTab = tab === "queue" ? "queue" : "onboardings"

  // Fetch both datasets in parallel
  const [records, handoffs, pendingCount] = await Promise.all([
    prisma.customerOnboarding.findMany({
      orderBy: { createdAt: "desc" },
      include: { organization: { select: { id: true, name: true, isDemo: true } } },
    }),
    activeTab === "queue"
      ? prisma.onboardingHandoff.findMany({
          orderBy: { createdAt: "asc" },
          select: {
            id: true, companyName: true, onboardingType: true, isTest: true,
            status: true, plan: true, submittedByName: true, createdAt: true,
            prospect: { select: { id: true } },
            opportunity: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.onboardingHandoff.findMany<{
          select: {
            id: true; companyName: true; onboardingType: true; isTest: true;
            status: true; plan: true; submittedByName: true; createdAt: true;
            prospect: { select: { id: true } };
            opportunity: { select: { id: true; title: true } };
          };
        }>>>),
    prisma.onboardingHandoff.count({ where: { status: "pending_review" } }),
  ])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Customer Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            White-glove onboarding management
          </p>
        </div>
        <NewOnboardingButton />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-800">
        <Link
          href="/super-admin/onboarding"
          className={[
            "px-4 py-2 text-sm font-semibold rounded-t transition-colors",
            activeTab === "onboardings"
              ? "text-white border-b-2 border-indigo-500 -mb-px bg-transparent"
              : "text-gray-500 hover:text-gray-300",
          ].join(" ")}
        >
          Active Onboardings
          <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
            {records.length}
          </span>
        </Link>
        <Link
          href="/super-admin/onboarding?tab=queue"
          className={[
            "px-4 py-2 text-sm font-semibold rounded-t transition-colors flex items-center gap-1.5",
            activeTab === "queue"
              ? "text-white border-b-2 border-indigo-500 -mb-px"
              : "text-gray-500 hover:text-gray-300",
          ].join(" ")}
        >
          Handoff Queue
          {pendingCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-yellow-500 text-black min-w-[18px] text-center">
              {pendingCount}
            </span>
          )}
          {pendingCount === 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
              0
            </span>
          )}
        </Link>
      </div>

      {/* ── Tab: Active Onboardings ── */}
      {activeTab === "onboardings" && (
        <>
          {/* Stats row */}
          {records.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              {Object.entries(ONBOARDING_STATUS).map(([status, cfg]) => {
                const count = records.filter(r => r.status === status).length
                return (
                  <div key={status} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-center">
                    <div className="text-lg font-bold text-white">{count}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{cfg.label}</div>
                  </div>
                )
              })}
            </div>
          )}

          {records.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <Building2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium mb-1">No onboarding records yet</p>
              <p className="text-gray-600 text-sm mb-4">Create one to start white-glove onboarding a new customer.</p>
              <NewOnboardingButton />
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Checklist</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trial Start</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {records.map(r => {
                    const cfg = ONBOARDING_STATUS[r.status] ?? { label: r.status, color: "bg-gray-800 text-gray-400 border-gray-700" }
                    const { done, total } = checklistProgress(r.checklist)
                    return (
                      <tr key={r.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/super-admin/onboarding/${r.id}`} className="text-white font-medium hover:text-indigo-400 transition-colors">
                              {r.organization.name}
                            </Link>
                            {r.organization.isDemo && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-900/50 text-amber-300 border border-amber-700/60 tracking-wide">
                                TEST
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{r.plan}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-300 text-xs">{r.primaryContactName}</div>
                          <div className="text-gray-500 text-[11px]">{r.primaryContactEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {done === total && total > 0
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              : done > 0
                              ? <Clock className="w-3.5 h-3.5 text-yellow-500" />
                              : <AlertCircle className="w-3.5 h-3.5 text-gray-600" />
                            }
                            <span className="text-xs text-gray-400">{done}/{total}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {r.trialStartDate ? format(new Date(r.trialStartDate), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {format(new Date(r.createdAt), "MMM d")}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Handoff Queue ── */}
      {activeTab === "queue" && (
        <>
          {handoffs.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <Inbox className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium mb-1">No handoff requests</p>
              <p className="text-gray-600 text-sm">Sales team handoffs will appear here for review.</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted by</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {handoffs.map(h => {
                    const cfg = HANDOFF_STATUS[h.status] ?? { label: h.status, color: "bg-gray-800 text-gray-400 border-gray-700" }
                    return (
                      <tr key={h.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{h.companyName}</span>
                            {h.isTest && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-900/50 text-amber-300 border border-amber-700/60 tracking-wide">
                                TEST
                              </span>
                            )}
                          </div>
                          {h.opportunity && (
                            <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[180px]">{h.opportunity.title}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs">{h.submittedByName}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs capitalize">{h.plan}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {format(new Date(h.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/super-admin/onboarding/handoffs/${h.id}`}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            Review →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
