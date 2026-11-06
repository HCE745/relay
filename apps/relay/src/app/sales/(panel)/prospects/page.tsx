import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Building2, Search, Filter, Plus } from "lucide-react"
import type { SearchParams } from "next/dist/server/request/search-params"
import { ProspectsTable } from "./ProspectsTable"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

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
          <ProspectsTable prospects={prospects} isManager={isManager} />
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
