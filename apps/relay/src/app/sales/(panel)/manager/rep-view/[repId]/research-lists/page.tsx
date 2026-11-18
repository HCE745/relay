import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { List, ChevronRight, CheckCircle2, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function buildCriteriaSummary(list: {
  searchCountry: string | null
  searchState: string | null
  searchIndustry: string | null
  searchEmpMin: number | null
  searchEmpMax: number | null
  searchKeywords: string | null
}) {
  const parts: string[] = []
  if (list.searchState) parts.push(list.searchState)
  else if (list.searchCountry) parts.push(list.searchCountry)
  if (list.searchIndustry) parts.push(list.searchIndustry)
  if (list.searchEmpMin && list.searchEmpMax) parts.push(`${list.searchEmpMin}–${list.searchEmpMax} emp`)
  else if (list.searchEmpMin) parts.push(`${list.searchEmpMin}+ emp`)
  if (list.searchKeywords) parts.push(`"${list.searchKeywords}"`)
  return parts.join(" · ") || null
}

export default async function RepViewResearchListsPage({
  params,
}: {
  params: Promise<{ repId: string }>
}) {
  const { repId } = await params

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const lists = await prisma.prospectResearchList.findMany({
    where: { salesUserId: repId, isExplicitlySaved: true },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      completedAt: true,
      manuallyCompleted: true,
      searchCountry: true,
      searchState: true,
      searchIndustry: true,
      searchEmpMin: true,
      searchEmpMax: true,
      searchKeywords: true,
      createdAt: true,
      _count: { select: { results: true } },
      results: {
        where: { isDone: true },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const basePath = `/sales/manager/rep-view/${repId}`

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">Research Lists</h2>
        <p className="text-xs text-gray-500 mt-0.5">{lists.length} saved list{lists.length !== 1 ? "s" : ""}</p>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-10 text-center">
          <List className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No saved research lists.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 overflow-hidden divide-y divide-gray-800">
          {lists.map(l => {
            const doneCount  = l.results.length
            const totalCount = l._count.results
            const criteria   = buildCriteriaSummary(l)
            const isComplete = l.status === "completed"
            return (
              <Link
                key={l.id}
                href={`${basePath}/research-lists/${l.id}`}
                className="flex items-center gap-4 px-5 py-4 bg-gray-900/40 hover:bg-gray-800/60 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white truncate">{l.name}</p>
                    {isComplete && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded-full shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Done
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {criteria && <span>{criteria}</span>}
                    {totalCount > 0 && (
                      <span>{doneCount}/{totalCount} worked</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {fmtDate(l.createdAt)}
                    </span>
                  </div>
                  {l.description && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{l.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-white">{totalCount}</p>
                  <p className="text-[10px] text-gray-600">companies</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
