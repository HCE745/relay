import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_COLOR, STATUS_COLOR, ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { formatDistanceToNow, format } from "date-fns"
import Link from "next/link"
import { Archive, Filter } from "lucide-react"

export const dynamic = "force-dynamic"

interface SearchParams {
  search?: string
  category?: string
  locationId?: string
  assignedToId?: string
  assetId?: string
  from?: string
  to?: string
  status?: string
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const filters = await searchParams
  const orgId = session.organizationId

  const where: Record<string, unknown> = {
    organizationId: orgId,
    status: { in: filters.status ? [filters.status] : ["RESOLVED", "CLOSED"] },
  }

  if (filters.search) where.title = { contains: filters.search, mode: "insensitive" }
  if (filters.category) where.category = filters.category
  if (filters.locationId) where.locationId = filters.locationId
  if (filters.assignedToId) where.assignedToId = filters.assignedToId
  if (filters.assetId) where.assetId = filters.assetId
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to + "T23:59:59Z") } : {}),
    }
  }

  const [issues, locations, users, assets] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        reportedBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        location: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true } },
      },
    }),
    prisma.location.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  function filterUrl(patch: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const merged = { ...filters, ...patch }
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v) })
    return `/archive?${p.toString()}`
  }

  return (
    <div>
      <Header title="Issue Archive" />
      <div className="p-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
            <Filter className="w-4 h-4" />
            Filters
          </div>
          <form method="GET" action="/archive" className="flex flex-wrap gap-3">
            <input
              name="search"
              defaultValue={filters.search}
              placeholder="Search title…"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
            <select name="status" defaultValue={filters.status ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Resolved & Closed</option>
              <option value="RESOLVED">Resolved only</option>
              <option value="CLOSED">Closed only</option>
            </select>
            <select name="category" defaultValue={filters.category ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All categories</option>
              {Object.entries(ISSUE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select name="locationId" defaultValue={filters.locationId ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select name="assignedToId" defaultValue={filters.assignedToId ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All assignees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select name="assetId" defaultValue={filters.assetId ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All assets</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <input name="from" type="date" defaultValue={filters.from ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-400 text-sm">to</span>
              <input name="to" type="date" defaultValue={filters.to ?? ""} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">Apply</button>
            {Object.values(filters).some(Boolean) && (
              <Link href="/archive" className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Clear</Link>
            )}
          </form>
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 text-sm text-gray-500">
            <Archive className="w-4 h-4" />
            {issues.length} archived issue{issues.length !== 1 ? "s" : ""}
          </div>

          {issues.length === 0 ? (
            <div className="py-16 text-center">
              <Archive className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No archived issues match your filters.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Issue</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Priority</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Location</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Assigned</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {issues.map(issue => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/issues/${issue.id}`} className="font-medium text-sm text-gray-900 hover:text-blue-600">
                        {issue.title}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {ISSUE_CATEGORY[issue.category as keyof typeof ISSUE_CATEGORY] ?? issue.category}
                        {issue.asset && <span className="ml-2">· {issue.asset.name}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={STATUS_COLOR[issue.status]}>
                        {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={PRIORITY_COLOR[issue.priority]}>
                        {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{issue.location?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{issue.assignedTo?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-sm text-gray-400" title={format(new Date(issue.updatedAt), "PPP")}>
                      {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
