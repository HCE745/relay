import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Briefcase, ChevronRight, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

const STAGES = [
  { key: "Qualified",   badge: "bg-blue-900/40 text-blue-300" },
  { key: "Demo",        badge: "bg-indigo-900/40 text-indigo-300" },
  { key: "Proposal",    badge: "bg-yellow-900/40 text-yellow-300" },
  { key: "Negotiating", badge: "bg-orange-900/40 text-orange-300" },
  { key: "Closed Won",  badge: "bg-green-900/40 text-green-300" },
  { key: "Closed Lost", badge: "bg-gray-800 text-gray-400" },
]

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—"
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default async function RepViewOpportunitiesPage({
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
      lostReason: true,
      prospect: { select: { id: true, companyName: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const basePath = `/sales/manager/rep-view/${repId}`
  const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]))
  const openOpps = opportunities.filter(o => !o.wonAt && !o.lostAt)
  const pipeline = openOpps.reduce((s, o) => s + Number(o.value ?? 0), 0)

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Opportunities</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {openOpps.length} open · {fmtMoney(pipeline)} pipeline
          </p>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-10 text-center">
          <Briefcase className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No opportunities assigned.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 overflow-hidden divide-y divide-gray-800">
          {opportunities.map(o => {
            const stageCfg = stageMap[o.stage] ?? { badge: "bg-gray-800 text-gray-400" }
            return (
              <Link
                key={o.id}
                href={`${basePath}/opportunities/${o.id}`}
                className="flex items-center gap-4 px-5 py-4 bg-gray-900/40 hover:bg-gray-800/60 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white truncate">{o.title}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${stageCfg.badge}`}>
                      {o.stage}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {o.prospect && <span>{o.prospect.companyName}</span>}
                    {o.closeDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Close {fmtDate(o.closeDate)}
                      </span>
                    )}
                    {o._count.tasks > 0 && (
                      <span>{o._count.tasks} task{o._count.tasks !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-white shrink-0 w-16 text-right">
                  {fmtMoney(o.value ? Number(o.value) : null)}
                </p>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
