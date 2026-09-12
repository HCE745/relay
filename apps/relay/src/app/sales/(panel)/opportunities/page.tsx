import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DollarSign, Plus } from "lucide-react"

export const dynamic = "force-dynamic"

const STAGES = [
  { key: "Qualified",    color: "text-blue-400",   border: "border-blue-900/50",   badge: "bg-blue-900/40 text-blue-300",   header: "bg-blue-900/20"   },
  { key: "Demo",         color: "text-indigo-400", border: "border-indigo-900/50", badge: "bg-indigo-900/40 text-indigo-300", header: "bg-indigo-900/20" },
  { key: "Proposal",     color: "text-yellow-400", border: "border-yellow-900/50", badge: "bg-yellow-900/40 text-yellow-300", header: "bg-yellow-900/20" },
  { key: "Negotiating",  color: "text-orange-400", border: "border-orange-900/50", badge: "bg-orange-900/40 text-orange-300", header: "bg-orange-900/20" },
  { key: "Closed Won",   color: "text-green-400",  border: "border-green-900/50",  badge: "bg-green-900/40 text-green-300",  header: "bg-green-900/20"  },
  { key: "Closed Lost",  color: "text-gray-500",   border: "border-gray-800",      badge: "bg-gray-800 text-gray-400",      header: "bg-gray-800/40"   },
]

function fmtValue(val: number | null | undefined): string {
  if (val == null) return "—"
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
  return `$${val}`
}

export default async function OpportunitiesPage() {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const isManager = session?.superAdmin || session?.salesUserRole === "admin_sales"
  const repFilter = isManager ? {} : { assignedToId: session?.salesUserId ?? "" }

  const opportunities = await prisma.crmOpportunity.findMany({
    where: repFilter,
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo: { select: { id: true, name: true } },
      prospect:   { select: { companyName: true } },
    },
  })

  const byStage = Object.fromEntries(
    STAGES.map(s => [s.key, opportunities.filter(o => o.stage === s.key)])
  )

  const totalOpen = opportunities.filter(o => o.stage !== "Closed Won" && o.stage !== "Closed Lost").length

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Opportunities</h1>
          <p className="text-gray-400 text-sm mt-0.5">{totalOpen} open deals</p>
        </div>
        <Link
          href="/sales/opportunities/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Opportunity
        </Link>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: "calc(100vh - 160px)" }}>
        {STAGES.map(stage => {
          const items = byStage[stage.key] ?? []
          return (
            <div key={stage.key} className="flex-shrink-0 w-72">
              {/* Column header */}
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${stage.header}`}>
                <h2 className={`text-sm font-semibold ${stage.color}`}>{stage.key}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                  {items.length}
                </span>
                {items.length > 0 && (
                  <span className="ml-auto text-xs text-gray-500">
                    {fmtValue(items.reduce((s, o) => s + Number(o.value ?? 0), 0))}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {items.map(opp => (
                  <Link
                    key={opp.id}
                    href={`/sales/opportunities/${opp.id}`}
                    className={`block bg-gray-800 border ${stage.border} rounded-xl p-3.5 hover:bg-gray-700/80 transition-colors group`}
                  >
                    <p className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors truncate mb-1">
                      {opp.title}
                    </p>

                    {opp.prospect && (
                      <p className="text-xs text-gray-400 truncate mb-2">
                        {opp.prospect.companyName}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      {opp.value != null ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <DollarSign className="w-3 h-3" />
                          {fmtValue(Number(opp.value))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">No value</span>
                      )}

                      {isManager && opp.assignedTo && (
                        <span className="text-xs text-gray-500">{opp.assignedTo.name}</span>
                      )}
                    </div>

                    {opp.closeDate && (
                      <p className="text-xs text-gray-600 mt-1.5">
                        Close {new Date(opp.closeDate).toLocaleDateString()}
                      </p>
                    )}
                  </Link>
                ))}

                {items.length === 0 && (
                  <div className="text-center py-6 text-gray-700 text-xs border border-dashed border-gray-800 rounded-xl">
                    No deals
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
