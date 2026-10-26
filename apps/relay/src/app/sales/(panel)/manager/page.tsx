import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { TransferActions } from "./TransferActions"
import { ManagerTabs } from "./ManagerTabs"
import { Users, TrendingUp, CheckCircle2, AlertCircle, Trophy, AlertTriangle, Phone, MessageSquare } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

function fmtValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

export default async function ManagerPage() {
  const session = await getSession()
  if (!session?.superAdmin && session?.salesUserRole !== "admin_sales") redirect("/sales")

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const now           = new Date()

  const duplicateCount = await prisma.prospect.count({ where: { duplicateFlag: true } })

  const [salesUsers, opportunities, tasks, pendingRequests, callActivities, objectionRows] = await Promise.all([
    prisma.salesUser.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),

    prisma.crmOpportunity.findMany({
      select: { assignedToId: true, stage: true, value: true, wonAt: true, createdAt: true },
    }),

    prisma.crmTask.findMany({
      select: { assignedToId: true, completedAt: true, dueAt: true, createdAt: true },
    }),

    prisma.crmTransferRequest.findMany({
      where:   { status: "pending" },
      include: {
        requestedBy: { select: { name: true } },
        toUser:      { select: { name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.salesCrmActivity.findMany({
      where:  { activityType: { in: ["CALL_ATTEMPTED", "CALL_CONNECTED"] }, occurredAt: { gte: thirtyDaysAgo } },
      select: { activityType: true, outcome: true, salesUserId: true },
    }),

    prisma.crmObjection.findMany({
      where:  { createdAt: { gte: thirtyDaysAgo } },
      select: { objectionType: true, wasResolved: true },
    }),
  ])

  // Call outcome stats (last 30d)
  const totalCalls     = callActivities.length
  const connectedCalls = callActivities.filter(a => a.activityType === "CALL_CONNECTED").length
  const connectRate    = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0

  const callOutcomeCounts: Record<string, number> = {}
  for (const a of callActivities) {
    if (a.outcome) callOutcomeCounts[a.outcome] = (callOutcomeCounts[a.outcome] ?? 0) + 1
  }
  const topCallOutcomes = Object.entries(callOutcomeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Objection analysis (last 30d)
  const objectionTypeCounts: Record<string, { total: number; resolved: number }> = {}
  for (const o of objectionRows) {
    if (!objectionTypeCounts[o.objectionType]) objectionTypeCounts[o.objectionType] = { total: 0, resolved: 0 }
    objectionTypeCounts[o.objectionType].total++
    if (o.wasResolved) objectionTypeCounts[o.objectionType].resolved++
  }
  const objectionStats = Object.entries(objectionTypeCounts)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 6)

  // Per-rep stats
  type RepStat = {
    id: string
    name: string
    email: string
    role: string
    openOpps: number
    wonLast30: number
    pipelineValue: number
    openTasks: number
    overdueTasks: number
  }

  const repStats: RepStat[] = salesUsers.map(u => {
    const myOpps  = opportunities.filter(o => o.assignedToId === u.id)
    const myTasks = tasks.filter(t => t.assignedToId === u.id)

    const openOpps     = myOpps.filter(o => o.stage !== "Closed Won" && o.stage !== "Closed Lost").length
    const wonLast30    = myOpps.filter(o => o.stage === "Closed Won" && o.wonAt && o.wonAt >= thirtyDaysAgo).length
    const pipelineValue = myOpps
      .filter(o => o.stage !== "Closed Lost")
      .reduce((s, o) => s + Number(o.value ?? 0), 0)
    const openTasks    = myTasks.filter(t => !t.completedAt).length
    const overdueTasks = myTasks.filter(t => !t.completedAt && t.dueAt && t.dueAt < now).length

    return { id: u.id, name: u.name, email: u.email, role: u.role, openOpps, wonLast30, pipelineValue, openTasks, overdueTasks }
  })

  // Team-level totals
  const totalOpenOpps      = opportunities.filter(o => o.stage !== "Closed Won" && o.stage !== "Closed Lost").length
  const totalWon30         = opportunities.filter(o => o.stage === "Closed Won" && o.wonAt && o.wonAt >= thirtyDaysAgo).length
  const totalPipeline      = opportunities.filter(o => o.stage !== "Closed Lost").reduce((s, o) => s + Number(o.value ?? 0), 0)
  const totalOverdueTasks  = tasks.filter(t => !t.completedAt && t.dueAt && t.dueAt < now).length

  return (
    <div className="p-6 max-w-6xl space-y-8">
      <ManagerTabs />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4" data-tour="mgr-dashboard-header">
        <div>
          <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{salesUsers.length} active reps</p>
        </div>
        {duplicateCount > 0 && (
          <Link
            href="/sales/manager/duplicates"
            data-tour="mgr-dup-banner"
            className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 border border-amber-700/40 hover:border-amber-500/60 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {duplicateCount} Duplicate {duplicateCount === 1 ? "Account" : "Accounts"}
              </p>
              <p className="text-xs text-amber-600">Awaiting review</p>
            </div>
          </Link>
        )}
      </div>

      {/* Team summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="mgr-funnel">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-gray-500">Open Opportunities</p>
          </div>
          <p className="text-2xl font-bold text-white">{totalOpenOpps}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-gray-500">Won (30d)</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{totalWon30}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-yellow-400" />
            <p className="text-xs text-gray-500">Pipeline Value</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{fmtValue(totalPipeline)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-xs text-gray-500">Overdue Tasks</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{totalOverdueTasks}</p>
        </div>
      </div>

      {/* Rep table */}
      <div data-tour="mgr-overdue-section">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Team Performance</h2>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Rep</th>
                  <th className="text-right px-4 py-3 font-medium">Open</th>
                  <th className="text-right px-4 py-3 font-medium">Won (30d)</th>
                  <th className="text-right px-4 py-3 font-medium">Pipeline</th>
                  <th className="text-right px-4 py-3 font-medium">Open Tasks</th>
                  <th className="text-right px-4 py-3 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {repStats.map(rep => (
                  <tr key={rep.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{rep.name}</p>
                      <p className="text-xs text-gray-600">{rep.role}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{rep.openOpps}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={rep.wonLast30 > 0 ? "text-emerald-400 font-semibold" : "text-gray-600"}>
                        {rep.wonLast30}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400 font-medium">
                      {rep.pipelineValue > 0 ? fmtValue(rep.pipelineValue) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{rep.openTasks}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={rep.overdueTasks > 0 ? "text-red-400 font-semibold" : "text-gray-600"}>
                        {rep.overdueTasks}
                      </span>
                    </td>
                  </tr>
                ))}
                {repStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-600">No active reps found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending transfer requests */}
      <div data-tour="mgr-transfers">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
          Pending Transfer Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-600 px-1">No pending transfer requests</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-gray-900 border border-yellow-900/50 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {req.opportunity?.title ?? "Unknown opportunity"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requested by <span className="text-gray-300">{req.requestedBy?.name ?? "unknown"}</span>
                    {" → "}
                    <span className="text-gray-300">{req.toUser?.name ?? "unknown"}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <TransferActions transferId={req.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Outcome Stats */}
      {totalCalls > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Call Activity (30d)</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total Calls</p>
              <p className="text-2xl font-bold text-white">{totalCalls}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Connected</p>
              <p className="text-2xl font-bold text-emerald-400">{connectedCalls}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Connect Rate</p>
              <p className="text-2xl font-bold text-blue-400">{connectRate}%</p>
            </div>
          </div>
          {topCallOutcomes.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Outcomes Breakdown</p>
              <div className="space-y-2">
                {topCallOutcomes.map(([outcome, count]) => (
                  <div key={outcome} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-40 truncate">{outcome.replace(/_/g, " ")}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${Math.round((count / totalCalls) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Objections Analysis */}
      {objectionStats.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Objections Analysis (30d)</h2>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Objection Type</th>
                  <th className="text-right px-4 py-3 font-medium">Count</th>
                  <th className="text-right px-4 py-3 font-medium">Resolved</th>
                  <th className="text-right px-4 py-3 font-medium">Resolve Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {objectionStats.map(([type, { total, resolved }]) => (
                  <tr key={type}>
                    <td className="px-4 py-3 text-gray-300">{type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">{total}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">{resolved}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-semibold ${
                        total > 0 && resolved / total >= 0.5 ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {total > 0 ? `${Math.round((resolved / total) * 100)}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
