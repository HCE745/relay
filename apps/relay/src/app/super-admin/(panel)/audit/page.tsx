import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { Shield } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

const ACTION_LABEL: Record<string, string> = {
  UPDATE_ORG:          "Edited org",
  SUSPEND_ORG:         "Suspended org",
  REACTIVATE_ORG:      "Reactivated org",
  RESET_ONBOARDING:    "Reset onboarding",
  UPDATE_TRIAL:        "Updated trial",
  CHANGE_USER_ROLE:    "Changed user role",
  CHANGE_USER_STATUS:  "Changed user status",
}
const ACTION_COLOR: Record<string, string> = {
  UPDATE_ORG:         "text-gray-300",
  SUSPEND_ORG:        "text-red-400",
  REACTIVATE_ORG:     "text-green-400",
  RESET_ONBOARDING:   "text-amber-400",
  UPDATE_TRIAL:       "text-amber-300",
  CHANGE_USER_ROLE:   "text-indigo-300",
  CHANGE_USER_STATUS: "text-blue-300",
}

function DiffCell({ before, after }: { before: unknown; after: unknown }) {
  if (!before && !after) return <span className="text-gray-600">—</span>
  const b = before as Record<string, unknown> | null
  const a = after  as Record<string, unknown> | null
  const keys = Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]))
    .filter((k) => (b?.[k] ?? null) !== (a?.[k] ?? null) && k !== "trialAction")
  if (keys.length === 0) return <span className="text-gray-600">—</span>
  return (
    <div className="space-y-0.5">
      {keys.map((k) => (
        <div key={k} className="text-xs">
          <span className="text-gray-500">{k}: </span>
          <span className="text-red-400 line-through mr-1">{String(b?.[k] ?? "—").slice(0, 30)}</span>
          <span className="text-green-400">{String(a?.[k] ?? "—").slice(0, 30)}</span>
        </div>
      ))}
    </div>
  )
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ saId?: string; orgId?: string; from?: string; to?: string; page?: string }>
}) {
  const { saId, orgId, from, to, page } = await searchParams
  const pageNum = Math.max(1, parseInt(page ?? "1", 10))
  const perPage = 50

  const where: Record<string, unknown> = {}
  if (saId) where.superAdminId = saId
  if (orgId) where.orgId = orgId
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to + "T23:59:59") } : {}),
    }
  }

  const [logs, total, allAdmins, impersonationLogs] = await Promise.all([
    prisma.superAdminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (pageNum - 1) * perPage,
      take:  perPage,
    }),
    prisma.superAdminAuditLog.count({ where }),
    prisma.superAdmin.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.impersonationLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      where: saId ? { superAdminId: saId } : orgId ? { organizationId: orgId } : undefined,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function buildUrl(updates: Record<string, string | undefined>) {
    const p = new URLSearchParams({ ...(saId ? { saId } : {}), ...(orgId ? { orgId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(page ? { page } : {}) })
    for (const [k, v] of Object.entries(updates)) {
      if (v) p.set(k, v); else p.delete(k)
    }
    return `/super-admin/audit?${p}`
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 text-sm mt-1">{total} admin action{total !== 1 ? "s" : ""} recorded</p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <select name="saId" defaultValue={saId ?? ""}
          className="px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="">All super admins</option>
          {allAdmins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input name="orgId" defaultValue={orgId} placeholder="Org ID or filter…"
          className="px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52" />
        <div className="flex items-center gap-2">
          <input type="date" name="from" defaultValue={from}
            className="px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <span className="text-gray-600 text-sm">to</span>
          <input type="date" name="to" defaultValue={to}
            className="px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">Filter</button>
        {(saId || orgId || from || to) && (
          <Link href="/super-admin/audit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg">Clear</Link>
        )}
      </form>

      {/* Admin actions log */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Admin Actions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-800">
                {["Timestamp", "Super Admin", "Action", "Organization", "Target", "Changes"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <p className="text-gray-500 text-sm">No actions recorded</p>
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                  </td>
                  <td className="px-5 py-3 text-gray-300 text-sm">{log.superAdminName}</td>
                  <td className="px-5 py-3">
                    <span className={`text-sm font-medium ${ACTION_COLOR[log.action] ?? "text-gray-300"}`}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-sm">{log.orgName}</td>
                  <td className="px-5 py-3">
                    <p className="text-gray-300 text-sm">{log.targetName}</p>
                    <p className="text-gray-600 text-xs">{log.targetType}</p>
                  </td>
                  <td className="px-5 py-3">
                    <DiffCell before={log.before} after={log.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-3">
            {pageNum > 1 && (
              <Link href={buildUrl({ page: String(pageNum - 1) })} className="text-indigo-400 hover:text-indigo-300 text-sm">← Prev</Link>
            )}
            <span className="text-gray-500 text-sm">Page {pageNum} of {totalPages}</span>
            {pageNum < totalPages && (
              <Link href={buildUrl({ page: String(pageNum + 1) })} className="text-indigo-400 hover:text-indigo-300 text-sm">Next →</Link>
            )}
          </div>
        )}
      </div>

      {/* Impersonation log */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Impersonation Sessions <span className="text-gray-500 font-normal">(last 20)</span></h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {["Super Admin", "Organization", "Target User", "Started", "Ended", "Duration"].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {impersonationLogs.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500 text-sm">No sessions recorded</td></tr>
            ) : impersonationLogs.map((log) => {
              const duration = log.endedAt ? Math.round((log.endedAt.getTime() - log.startedAt.getTime()) / 60000) : null
              return (
                <tr key={log.id} className="hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-gray-300 text-sm font-medium">{log.superAdminName}</td>
                  <td className="px-5 py-3 text-gray-300 text-sm">{log.orgName}</td>
                  <td className="px-5 py-3 text-gray-400 text-sm">{log.targetUserName}</td>
                  <td className="px-5 py-3 text-gray-400 text-sm">{format(new Date(log.startedAt), "MMM d, HH:mm")}</td>
                  <td className="px-5 py-3 text-gray-400 text-sm">
                    {log.endedAt ? format(new Date(log.endedAt), "HH:mm") : <span className="text-amber-400 text-xs">Active</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-sm">{duration !== null ? `${duration}m` : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
