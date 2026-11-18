import { redirect, notFound } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ArrowLeft, Building2, CheckSquare, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—"
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

const STAGE_BADGE: Record<string, string> = {
  "Qualified":   "bg-blue-900/40 text-blue-300",
  "Demo":        "bg-indigo-900/40 text-indigo-300",
  "Proposal":    "bg-yellow-900/40 text-yellow-300",
  "Negotiating": "bg-orange-900/40 text-orange-300",
  "Closed Won":  "bg-green-900/40 text-green-300",
  "Closed Lost": "bg-gray-800 text-gray-400",
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "text-red-400",
  normal: "text-gray-400",
  low:    "text-gray-600",
}

export default async function RepViewOppDetailPage({
  params,
}: {
  params: Promise<{ repId: string; oppId: string }>
}) {
  const { repId, oppId } = await params

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const opp = await prisma.crmOpportunity.findUnique({
    where: { id: oppId },
    include: {
      prospect: { select: { id: true, companyName: true } },
      contact:  { select: { id: true, name: true, title: true } },
      tasks: {
        select: {
          id: true, title: true, taskType: true, dueAt: true,
          completedAt: true, priority: true, notes: true,
        },
        orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
        take: 30,
      },
    },
  })

  if (!opp) notFound()
  // Enforce rep scoping
  if (opp.assignedToId !== repId) redirect(`/sales/manager/rep-view/${repId}/opportunities`)

  const basePath = `/sales/manager/rep-view/${repId}`
  const stageBadge = STAGE_BADGE[opp.stage] ?? "bg-gray-800 text-gray-400"
  const now = new Date()

  const fields: { label: string; value: string | null }[] = [
    { label: "Stage",        value: opp.stage },
    { label: "Value",        value: fmtMoney(opp.value ? Number(opp.value) : null) },
    { label: "Close Date",   value: fmtDate(opp.closeDate) },
    { label: "Product",      value: opp.product || null },
    { label: "Lead Source",  value: opp.leadSource ?? null },
    { label: "Won",          value: fmtDate(opp.wonAt) },
    { label: "Lost",         value: fmtDate(opp.lostAt) },
    { label: "Lost Reason",  value: opp.lostReason ?? null },
    { label: "Next Step",    value: opp.nextStep ?? null },
    { label: "Next Step Due",value: fmtDate(opp.nextStepDate) },
  ].filter(f => f.value)

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <Link
        href={`${basePath}/opportunities`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Opportunities
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold text-white truncate">{opp.title}</h1>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${stageBadge}`}>
                {opp.stage}
              </span>
            </div>
            {opp.prospect && (
              <Link
                href={`${basePath}/prospects/${opp.prospect.id}`}
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                {opp.prospect.companyName}
              </Link>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500 mb-0.5">Value</p>
            <p className="text-2xl font-semibold text-white">{fmtMoney(opp.value ? Number(opp.value) : null)}</p>
          </div>
        </div>

        {/* Key fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          {fields.map(f => (
            <div key={f.label}>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide font-medium mb-0.5">{f.label}</p>
              <p className="text-sm text-gray-300">{f.value}</p>
            </div>
          ))}
        </div>

        {opp.contact && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Primary Contact</p>
            <p className="text-sm text-gray-300">
              {opp.contact.name}
              {opp.contact.title && <span className="text-gray-500"> · {opp.contact.title}</span>}
            </p>
          </div>
        )}

        {opp.notes && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Notes</p>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{opp.notes}</p>
          </div>
        )}
      </div>

      {/* Tasks */}
      {opp.tasks.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-gray-500" />
              Tasks ({opp.tasks.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-800">
            {opp.tasks.map(t => {
              const isOverdue = !t.completedAt && t.dueAt && new Date(t.dueAt) < now
              return (
                <div key={t.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center ${
                    t.completedAt ? "bg-emerald-900/30 border border-emerald-700" : "border border-gray-600"
                  }`}>
                    {t.completedAt && <span className="text-emerald-400 text-[8px]">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.completedAt ? "text-gray-500 line-through" : "text-white"}`}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs">
                      {t.dueAt && (
                        <span className={`flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-gray-500"}`}>
                          <Clock className="w-3 h-3" />
                          {isOverdue ? "Overdue · " : "Due "}{fmtDate(t.dueAt)}
                        </span>
                      )}
                      {t.priority !== "normal" && (
                        <span className={`capitalize ${PRIORITY_COLORS[t.priority] ?? "text-gray-400"}`}>
                          {t.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
