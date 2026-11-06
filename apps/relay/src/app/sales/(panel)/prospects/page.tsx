import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Building2, Users, Briefcase, Search, Filter, Plus } from "lucide-react"
import type { SearchParams } from "next/dist/server/request/search-params"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

const STATUS_STYLES: Record<string, { text: string; bg: string }> = {
  researched:     { text: "text-blue-400",    bg: "bg-blue-900/30"    },
  contacted:      { text: "text-indigo-400",  bg: "bg-indigo-900/30"  },
  replied:        { text: "text-emerald-400", bg: "bg-emerald-900/30" },
  demo_scheduled: { text: "text-green-400",   bg: "bg-green-900/30"   },
  trial:          { text: "text-purple-400",  bg: "bg-purple-900/30"  },
  customer:       { text: "text-teal-400",    bg: "bg-teal-900/30"    },
  not_interested: { text: "text-gray-500",    bg: "bg-gray-800/60"    },
  do_not_contact: { text: "text-red-400",     bg: "bg-red-900/30"     },
}

const STATUS_LABELS: Record<string, string> = {
  researched:     "Researched",
  contacted:      "Contacted",
  replied:        "Replied",
  demo_scheduled: "Demo Scheduled",
  trial:          "Trial",
  customer:       "Customer",
  not_interested: "Not Interested",
  do_not_contact: "Do Not Contact",
}

function buildOrderBy(sort: string) {
  const map: Record<string, object> = {
    updatedAt_desc:   { updatedAt: "desc" },
    updatedAt_asc:    { updatedAt: "asc" },
    companyName_asc:  { companyName: "asc" },
    companyName_desc: { companyName: "desc" },
    aiFitScore_desc:  { aiFitScore: "desc" },
    createdAt_desc:   { createdAt: "desc" },
  }
  return map[sort] ?? { updatedAt: "desc" }
}

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const sp     = await searchParams
  const q      = typeof sp.q      === "string" ? sp.q.trim() : ""
  const status = typeof sp.status === "string" ? sp.status   : ""
  const sort   = typeof sp.sort   === "string" ? sp.sort     : "updatedAt_desc"
  const page   = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"))

  const isManager = session.superAdmin || session.salesUserRole === "admin_sales"
  const repFilter = isManager ? {} : { assignedToId: session.salesUserId ?? "" }

  const where: Record<string, unknown> = { ...repFilter }
  if (q) {
    where.OR = [
      { companyName:        { contains: q, mode: "insensitive" } },
      { industry:           { contains: q, mode: "insensitive" } },
      { headquartersCity:   { contains: q, mode: "insensitive" } },
      { headquartersState:  { contains: q, mode: "insensitive" } },
      { website:            { contains: q, mode: "insensitive" } },
      { contacts: { some: { OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name:  { contains: q, mode: "insensitive" } },
      ] } } },
    ]
  }
  if (status) where.currentCrmStatus = status

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: buildOrderBy(sort),
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
      select: {
        id:               true,
        companyName:      true,
        website:          true,
        industry:         true,
        phone:            true,
        headquartersCity: true,
        headquartersState:true,
        currentCrmStatus: true,
        aiFitScore:       true,
        duplicateFlag:    true,
        tags:             true,
        updatedAt:        true,
        assignedTo:       { select: { id: true, name: true } },
        contacts:         {
          select: { id: true, name: true, title: true, email: true, isPrimaryContact: true },
          orderBy: { isPrimaryContact: "desc" },
          take: 3,
        },
        opportunities: {
          select: { id: true, stage: true, value: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { contacts: true, opportunities: true } },
      },
    }),
    prisma.prospect.count({ where }),
  ])

  const pages = Math.ceil(total / PAGE_SIZE)

  function pageUrl(p: number, overrides: Record<string, string> = {}) {
    const params = new URLSearchParams()
    if (q)      params.set("q", q)
    if (status) params.set("status", status)
    if (sort && sort !== "updatedAt_desc") params.set("sort", sort)
    params.set("page", String(p))
    Object.entries(overrides).forEach(([k, v]) => v ? params.set(k, v) : params.delete(k))
    return `/sales/prospects?${params}`
  }

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div data-tour="prospect-list-header" className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospects</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sales/outreach/prospects/discover"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Find Prospects
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <form method="get" action="/sales/prospects" className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search prospects, contacts, domains…"
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="updatedAt_desc">Recently updated</option>
          <option value="updatedAt_asc">Oldest updated</option>
          <option value="companyName_asc">Name A–Z</option>
          <option value="companyName_desc">Name Z–A</option>
          <option value="aiFitScore_desc">Fit score</option>
          <option value="createdAt_desc">Recently added</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm text-white rounded-lg transition-colors">
          <Filter className="w-4 h-4" />
        </button>
        {(q || status) && (
          <Link href="/sales/prospects" className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Prospect</th>
                <th className="text-left px-4 py-3 font-medium">Primary Contact</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Pipeline</th>
                <th className="text-left px-4 py-3 font-medium">Contacts</th>
                {isManager && <th className="text-left px-4 py-3 font-medium">Rep</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {prospects.map(p => {
                const primary  = p.contacts.find(c => c.isPrimaryContact) ?? p.contacts[0]
                const opp      = p.opportunities[0]
                const style    = STATUS_STYLES[p.currentCrmStatus] ?? { text: "text-gray-400", bg: "bg-gray-800/60" }
                const href     = `/sales/prospects/${p.id}`
                return (
                  <tr key={p.id} className="relative hover:bg-gray-800/30 transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      {/* Full-row overlay link — covers the entire row */}
                      <Link
                        href={href}
                        className="absolute inset-0"
                        aria-label={`Open prospect: ${p.companyName}`}
                      />
                      <div className="flex items-center gap-2.5 relative">
                        <div className="w-8 h-8 rounded-lg bg-indigo-900/40 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                            {p.companyName}
                            {p.duplicateFlag && <span className="ml-1.5 text-[10px] text-amber-400 bg-amber-900/30 px-1 py-0.5 rounded">dup</span>}
                          </p>
                          {(p.industry || p.headquartersCity) && (
                            <p className="text-xs text-gray-600">
                              {[p.industry, p.headquartersCity && p.headquartersState
                                ? `${p.headquartersCity}, ${p.headquartersState}`
                                : p.headquartersCity].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 relative">
                      {primary ? (
                        <div>
                          <p className="text-gray-200 text-sm">{primary.name}</p>
                          <p className="text-xs text-gray-600">{primary.title ?? primary.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 relative">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {STATUS_LABELS[p.currentCrmStatus] ?? p.currentCrmStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 relative">
                      {opp ? (
                        <div>
                          <p className="text-gray-300 text-xs font-medium">{opp.stage}</p>
                          {opp.value && <p className="text-xs text-gray-600">${Number(opp.value).toLocaleString()}</p>}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 relative">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Users className="w-3 h-3" />
                        {p._count.contacts}
                      </span>
                    </td>
                    {isManager && (
                      <td className="px-4 py-3 relative text-xs text-gray-500">{p.assignedTo?.name ?? "—"}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {prospects.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No prospects found</p>
            <Link href="/sales/outreach/prospects/discover" className="mt-3 inline-block text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
              Find Prospects →
            </Link>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-gray-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link href={pageUrl(page - 1)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                ← Prev
              </Link>
            )}
            <span className="text-gray-500">Page {page} of {pages}</span>
            {page < pages && (
              <Link href={pageUrl(page + 1)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
