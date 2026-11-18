import { redirect, notFound } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ArrowLeft, Building2, MapPin, Users, CheckCircle2, ExternalLink } from "lucide-react"

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
  searchContext: string | null
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

export default async function RepViewResearchListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string; listId: string }>
  searchParams: Promise<{ show?: string }>
}) {
  const { repId, listId } = await params
  const { show = "all" } = await searchParams

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const list = await prisma.prospectResearchList.findUnique({
    where: { id: listId },
    include: {
      results: {
        select: {
          id: true,
          companyName: true,
          website: true,
          verifiedCity: true,
          verifiedState: true,
          industry: true,
          estimatedEmployees: true,
          summary: true,
          fitScore: true,
          painPoints: true,
          relayFitReasons: true,
          outreachAngle: true,
          isDone: true,
          doneAt: true,
          prospectId: true,
          promotedAt: true,
          researchDate: true,
        },
        orderBy: [{ fitScore: "desc" }, { companyName: "asc" }],
      },
    },
  })

  if (!list) notFound()
  // Enforce rep scoping — this list must belong to the rep
  if (list.salesUserId !== repId) redirect(`/sales/manager/rep-view/${repId}/research-lists`)

  const basePath    = `/sales/manager/rep-view/${repId}`
  const criteria    = buildCriteriaSummary(list)
  const doneCount   = list.results.filter(r => r.isDone).length
  const promotedCount = list.results.filter(r => r.prospectId).length

  const displayResults = show === "done"
    ? list.results.filter(r => r.isDone)
    : show === "pending"
    ? list.results.filter(r => !r.isDone)
    : list.results

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <Link
        href={`${basePath}/research-lists`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Research Lists
      </Link>

      {/* List header */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">{list.name}</h1>
            {list.description && (
              <p className="text-sm text-gray-400 mt-0.5">{list.description}</p>
            )}
            {criteria && (
              <p className="text-xs text-gray-500 mt-1">{criteria}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500 mb-1">Created {fmtDate(list.createdAt)}</p>
            {list.status === "completed" && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Completed
              </span>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Companies</p>
            <p className="text-xl font-semibold text-white">{list.results.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Worked</p>
            <p className="text-xl font-semibold text-white">{doneCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Added to CRM</p>
            <p className="text-xl font-semibold text-emerald-400">{promotedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1">
        {[
          { key: "all",     label: `All (${list.results.length})` },
          { key: "pending", label: `Pending (${list.results.length - doneCount})` },
          { key: "done",    label: `Done (${doneCount})` },
        ].map(f => (
          <Link
            key={f.key}
            href={`?show=${f.key}`}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              show === f.key ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Results */}
      {displayResults.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-8 text-center">
          <p className="text-sm text-gray-400">No companies in this filter.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 overflow-hidden divide-y divide-gray-800">
          {displayResults.map(r => (
            <div key={r.id} className="px-5 py-4 bg-gray-900/40">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-medium text-white">{r.companyName}</p>
                    {r.isDone && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded-full">
                        Done
                      </span>
                    )}
                    {r.prospectId && (
                      <Link
                        href={`${basePath}/prospects/${r.prospectId}`}
                        className="text-[10px] font-semibold text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded-full hover:text-blue-300 transition-colors"
                      >
                        In CRM →
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {r.industry && <span>{r.industry}</span>}
                    {(r.verifiedCity || r.verifiedState) && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {[r.verifiedCity, r.verifiedState].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {r.estimatedEmployees && (
                      <span className="flex items-center gap-0.5">
                        <Users className="w-2.5 h-2.5" />
                        {r.estimatedEmployees}
                      </span>
                    )}
                    {r.website && (
                      <a
                        href={r.website.startsWith("http") ? r.website : `https://${r.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-blue-500 hover:text-blue-400"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {r.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                  {r.summary && (
                    <p className="mt-1.5 text-xs text-gray-400 leading-relaxed line-clamp-2">{r.summary}</p>
                  )}
                  {r.outreachAngle && (
                    <p className="mt-1 text-xs text-gray-500 italic line-clamp-1">Angle: {r.outreachAngle}</p>
                  )}
                </div>
                {r.fitScore != null && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-500 mb-0.5">Fit</p>
                    <p className="text-lg font-semibold text-emerald-400">{r.fitScore}</p>
                  </div>
                )}
              </div>

              {r.painPoints.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.painPoints.slice(0, 3).map((p, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-900/30">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
