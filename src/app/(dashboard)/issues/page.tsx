import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, X } from "lucide-react"
import { IssueFilters } from "@/components/issues/issue-filters"
import { IssuesList } from "@/components/issues/issues-list"
import { SavedViews } from "@/components/issues/saved-views"
import type { ViewFilters, IssueColumnKey } from "@/lib/custom-view-config"
import { resolveViewIcon } from "@/lib/custom-view-config"

export const dynamic = "force-dynamic"

interface SearchParams {
  view?:        string
  status?:      string
  priority?:    string
  category?:    string
  search?:      string
  locationId?:  string
  isEscalated?: string
  sort?:        string
}

type SortPair = [string, "asc" | "desc"]

function resolveSortPairs(field: string | null | undefined, dir: string | null | undefined): SortPair[] {
  if (field === "createdAt" && dir === "asc")  return [["createdAt", "asc"]]
  if (field === "createdAt" && dir === "desc") return [["createdAt", "desc"]]
  if (field === "updatedAt" && dir === "desc") return [["updatedAt", "desc"]]
  return [["priority", "desc"], ["createdAt", "desc"]]
}

async function getIssues(orgId: string, filters: ViewFilters, sortField?: string | null, sortDir?: string | null) {
  const where: Record<string, unknown> = { organizationId: orgId }
  if (filters.status)       where.status     = filters.status
  if (filters.priority)     where.priority   = filters.priority
  if (filters.category)     where.category   = filters.category
  if (filters.search)       where.title      = { contains: filters.search, mode: "insensitive" }
  if (filters.locationId)   where.locationId = filters.locationId
  if (filters.isEscalated === true || filters.isEscalated as unknown === "true") where.isEscalated = true

  const orderBy = resolveSortPairs(sortField, sortDir).map(([f, d]) => ({ [f]: d }))

  return prisma.issue.findMany({
    where,
    orderBy,
    include: {
      reportedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      location:   { select: { name: true, id: true } },
      asset:      { select: { name: true } },
      _count:     { select: { comments: true } },
    },
  })
}

export default async function IssuesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  const params = await searchParams

  // ── Custom view mode ────────────────────────────────────────────────────────
  let activeView: {
    id: string
    name: string
    icon: string | null
    filters: ViewFilters
    columns: IssueColumnKey[] | null
    sortField: string | null
    sortDir: string | null
  } | null = null

  if (params.view) {
    const dbView = await prisma.customView.findUnique({ where: { id: params.view } })
    if (dbView && dbView.organizationId === session.organizationId) {
      activeView = {
        id:        dbView.id,
        name:      dbView.name,
        icon:      dbView.icon,
        filters:   (dbView.filters ?? {}) as ViewFilters,
        columns:   Array.isArray(dbView.columns) ? dbView.columns as IssueColumnKey[] : null,
        sortField: dbView.sortField,
        sortDir:   dbView.sortDir,
      }
    }
    // If view ID not found or wrong org, fall through to normal filter mode
  }

  const effectiveFilters: ViewFilters = activeView
    ? { ...activeView.filters }
    : {
        status:      params.status,
        priority:    params.priority,
        category:    params.category,
        search:      params.search,
        locationId:  params.locationId,
        isEscalated: params.isEscalated === "true" ? true : undefined,
      }

  const effectiveSortField = activeView ? activeView.sortField : null
  const effectiveSortDir   = activeView ? activeView.sortDir   : null

  const [issues, users, org, locations] = await Promise.all([
    getIssues(session.organizationId, effectiveFilters, effectiveSortField, effectiveSortDir),
    prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.organization.findUnique({ where: { id: session.organizationId }, select: { industry: true } }),
    prisma.location.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  // Page title
  const isCarWash = org?.industry === "Car Wash"
  let pageTitle = activeView
    ? activeView.name
    : isCarWash
    ? params.category === "CUSTOMER_REPORT"
      ? "Customer Reports"
      : params.category === "MAINTENANCE"
      ? "Maintenance"
      : "Issues"
    : "Issues"

  const currentFilters: Record<string, string> = {}
  if (!activeView) {
    if (params.status)      currentFilters.status      = params.status
    if (params.priority)    currentFilters.priority    = params.priority
    if (params.category)    currentFilters.category    = params.category
    if (params.search)      currentFilters.search      = params.search
    if (params.locationId)  currentFilters.locationId  = params.locationId
    if (params.isEscalated) currentFilters.isEscalated = params.isEscalated
  }

  const ViewIcon = activeView ? resolveViewIcon(activeView.icon) : null

  return (
    <div>
      <Header title={pageTitle} />

      <div className="md:hidden flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
        <Link href="/issues/new" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" />
          Report
        </Link>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6">
        {activeView ? (
          /* ── View active — show banner, suppress filter bar ─────────────── */
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
            {ViewIcon && <ViewIcon className="w-4 h-4 text-blue-600 shrink-0" />}
            <span className="text-sm font-semibold text-blue-900 flex-1 truncate">{activeView.name}</span>
            <Link
              href="/issues"
              className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Exit view
            </Link>
          </div>
        ) : (
          /* ── Normal filter mode ─────────────────────────────────────────── */
          <IssueFilters initialFilters={params} locations={locations} />
        )}

        <div className="mt-3" data-tour="issue-list">
          {!activeView && <SavedViews currentFilters={currentFilters} />}
          <IssuesList
            issues={issues}
            users={users}
            currentFilters={currentFilters}
            visibleColumns={activeView?.columns ?? null}
          />
        </div>
      </div>
    </div>
  )
}
