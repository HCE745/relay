import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

const STAGES = [
  { key: "Qualified",   color: "text-blue-400",   bar: "bg-blue-500",   badge: "bg-blue-900/40 text-blue-300" },
  { key: "Demo",        color: "text-indigo-400", bar: "bg-indigo-500", badge: "bg-indigo-900/40 text-indigo-300" },
  { key: "Proposal",    color: "text-yellow-400", bar: "bg-yellow-500", badge: "bg-yellow-900/40 text-yellow-300" },
  { key: "Negotiating", color: "text-orange-400", bar: "bg-orange-500", badge: "bg-orange-900/40 text-orange-300" },
  { key: "Closed Won",  color: "text-green-400",  bar: "bg-green-500",  badge: "bg-green-900/40 text-green-300" },
  { key: "Closed Lost", color: "text-gray-500",   bar: "bg-gray-600",   badge: "bg-gray-800 text-gray-400" },
]

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default async function RepViewPipelinePage({
  params,
}: {
  params: Promise<{ repId: string }>
}) {
  const { repId } = await params

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const opportunities = await prisma.crmOpportunity.findMany({
    where: { assignedToId: repId },
    select: {
      id: true,
      title: true,
      stage: true,
      value: true,
      closeDate: true,
      wonAt: true,
      lostAt: true,
      prospect: { select: { id: true, companyName: true } },
    },
    orderBy: { value: "desc" },
  })

  const basePath = `/sales/manager/rep-view/${repId}`
  const byStage = Object.fromEntries(STAGES.map(s => [s.key, opportunities.filter(o => o.stage === s.key)]))
  const totalPipeline = opportunities
    .filter(o => !o.wonAt && !o.lostAt)
    .reduce((s, o) => s + Number(o.value ?? 0), 0)
  const maxStageValue = Math.max(
    1,
    ...STAGES.map(s => byStage[s.key]?.reduce((sum, o) => sum + Number(o.value ?? 0), 0) ?? 0),
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white">Pipeline</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {fmtMoney(totalPipeline)} open pipeline · {opportunities.length} total opportunities
        </p>
      </div>

      <div className="space-y-4">
        {STAGES.map(stage => {
          const stageOpps = byStage[stage.key] ?? []
          const stageValue = stageOpps.reduce((s, o) => s + Number(o.value ?? 0), 0)
          const barPct = maxStageValue > 0 ? (stageValue / maxStageValue) * 100 : 0

          return (
            <div key={stage.key} className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
              {/* Stage header */}
              <div className="px-5 py-3 border-b border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${stage.color}`}>{stage.key}</span>
                    <span className="text-xs text-gray-600">({stageOpps.length})</span>
                  </div>
                  <span className={`text-sm font-semibold ${stage.color}`}>{fmtMoney(stageValue)}</span>
                </div>
                {/* Value bar */}
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stage.bar}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {stageOpps.length > 0 && (
                <div className="divide-y divide-gray-800">
                  {stageOpps.map(o => (
                    <Link
                      key={o.id}
                      href={`${basePath}/opportunities/${o.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/40 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{o.title}</p>
                        {o.prospect && (
                          <p className="text-xs text-gray-500 mt-0.5">{o.prospect.companyName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                        {o.closeDate && <span>Close {fmtDate(o.closeDate)}</span>}
                        <span className="text-white font-medium text-sm w-14 text-right">
                          {fmtMoney(Number(o.value ?? 0))}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}

              {stageOpps.length === 0 && (
                <p className="px-5 py-3 text-xs text-gray-600 italic">No opportunities in this stage.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
