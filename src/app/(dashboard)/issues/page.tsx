import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"
import { IssueFilters } from "@/components/issues/issue-filters"
import { IssuesList } from "@/components/issues/issues-list"
import { SavedViews } from "@/components/issues/saved-views"

export const dynamic = "force-dynamic"

interface SearchParams {
  status?: string
  priority?: string
  category?: string
  search?: string
}

async function getIssues(orgId: string, filters: SearchParams) {
  const where: Record<string, unknown> = { organizationId: orgId }
  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.category) where.category = filters.category
  if (filters.search) where.title = { contains: filters.search }

  return prisma.issue.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      reportedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      location: { select: { name: true } },
      asset: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  })
}

export default async function IssuesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  const params = await searchParams

  const [issues, users] = await Promise.all([
    getIssues(session.organizationId, params),
    prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ])

  const currentFilters: Record<string, string> = {}
  if (params.status)   currentFilters.status   = params.status
  if (params.priority) currentFilters.priority = params.priority
  if (params.category) currentFilters.category = params.category
  if (params.search)   currentFilters.search   = params.search

  return (
    <div>
      <Header title="Issues" />

      <div className="md:hidden flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Issues</h1>
        <Link href="/issues/new" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" />
          Report
        </Link>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6">
        <IssueFilters initialFilters={params} />
        <div className="mt-3" data-tour="issue-list">
          <SavedViews currentFilters={currentFilters} />
          <IssuesList issues={issues} users={users} currentFilters={currentFilters} />
        </div>
      </div>
    </div>
  )
}
