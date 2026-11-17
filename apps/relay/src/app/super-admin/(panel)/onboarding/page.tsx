import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { format } from "date-fns"
import { Plus, Building2, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { NewOnboardingButton } from "./new-onboarding-button"

export const dynamic = "force-dynamic"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:            { label: "Draft",             color: "bg-gray-800 text-gray-400 border-gray-700" },
  configuring:      { label: "Configuring",       color: "bg-blue-900/50 text-blue-300 border-blue-700" },
  ready_for_review: { label: "Ready for Review",  color: "bg-yellow-900/50 text-yellow-300 border-yellow-700" },
  ready_to_launch:  { label: "Ready to Launch",   color: "bg-indigo-900/50 text-indigo-300 border-indigo-700" },
  live:             { label: "Live",              color: "bg-green-900/50 text-green-300 border-green-700" },
}

function checklistProgress(checklist: unknown): { done: number; total: number } {
  if (!Array.isArray(checklist)) return { done: 0, total: 0 }
  return {
    done:  checklist.filter((i: { completedAt: string | null }) => i.completedAt).length,
    total: checklist.length,
  }
}

export default async function OnboardingListPage() {
  const records = await prisma.customerOnboarding.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { id: true, name: true } },
    },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Customer Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            White-glove onboarding records — {records.length} total
          </p>
        </div>
        <NewOnboardingButton />
      </div>

      {/* Stats row */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
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

      {/* Table */}
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
                const cfg = STATUS_CONFIG[r.status] ?? { label: r.status, color: "bg-gray-800 text-gray-400 border-gray-700" }
                const { done, total } = checklistProgress(r.checklist)
                return (
                  <tr key={r.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/onboarding/${r.id}`} className="text-white font-medium hover:text-indigo-400 transition-colors">
                        {r.organization.name}
                      </Link>
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
    </div>
  )
}
