import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Building2, Globe, MapPin, Users, TrendingUp, Search, Plus, Compass } from "lucide-react"
import type { ProspectCrmStatus } from "@/generated/prisma/enums"

export const dynamic = "force-dynamic"

const INDUSTRY_OPTIONS = [
  "Manufacturing",
  "Food & Beverage",
  "Warehousing & Logistics",
  "Retail",
  "Healthcare",
  "Hospitality",
  "Construction",
  "Property Management",
  "Education",
  "Other",
]

const STATUS_LABELS: Record<ProspectCrmStatus, string> = {
  researched:      "Researched",
  contacted:       "Contacted",
  replied:         "Replied",
  demo_scheduled:  "Demo Scheduled",
  trial:           "Trial",
  customer:        "Customer",
  not_interested:  "Not Interested",
  do_not_contact:  "Do Not Contact",
}

const STATUS_COLORS: Record<ProspectCrmStatus, string> = {
  researched:     "bg-gray-700/60 text-gray-300 border-gray-600",
  contacted:      "bg-blue-900/50 text-blue-300 border-blue-700",
  replied:        "bg-indigo-900/50 text-indigo-300 border-indigo-700",
  demo_scheduled: "bg-purple-900/50 text-purple-300 border-purple-700",
  trial:          "bg-amber-900/50 text-amber-300 border-amber-700",
  customer:       "bg-green-900/50 text-green-300 border-green-700",
  not_interested: "bg-red-900/50 text-red-300 border-red-700",
  do_not_contact: "bg-red-900/50 text-red-300 border-red-700",
}

function fitScoreBadge(score: number | null): { label: string; className: string } {
  if (score === null) return { label: "—", className: "bg-gray-700/60 text-gray-400 border-gray-600" }
  if (score >= 80)    return { label: String(score), className: "bg-green-900/50 text-green-300 border-green-700" }
  if (score >= 60)    return { label: String(score), className: "bg-amber-900/50 text-amber-300 border-amber-700" }
  return               { label: String(score), className: "bg-red-900/50 text-red-300 border-red-700" }
}

function relativeDate(date: Date | null | undefined): string {
  if (!date) return "Never"
  const diffMs   = Date.now() - new Date(date).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0)  return "Today"
  if (diffDays === 1)  return "Yesterday"
  if (diffDays < 7)   return `${diffDays}d ago`
  if (diffDays < 30)  return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function ProspectsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const search   = typeof searchParams.search   === "string" ? searchParams.search.trim()   : ""
  const industry = typeof searchParams.industry === "string" ? searchParams.industry.trim() : ""
  const status   = typeof searchParams.status   === "string" ? searchParams.status.trim()   : ""
  const score    = typeof searchParams.score    === "string" ? searchParams.score.trim()    : ""

  // Build where clause from filters
  const scoreFilter =
    score === "80+"   ? { gte: 80 } :
    score === "60-79" ? { gte: 60, lt: 80 } :
    score === "<60"   ? { lt: 60 } :
    undefined

  const prospects = await prisma.prospect.findMany({
    where: {
      ...(search   ? { companyName:      { contains: search, mode: "insensitive" as const } } : {}),
      ...(industry ? { industry }                                                              : {}),
      ...(status   ? { currentCrmStatus: status as ProspectCrmStatus }                        : {}),
      ...(scoreFilter ? { aiFitScore: scoreFilter }                                           : {}),
    },
    include: { contacts: { take: 1 } },
    orderBy: { aiFitScore: "desc" },
  })

  // Stats (always computed from full dataset, not filtered)
  const [totalCount, highFitCount, contactedCount, avgFitRaw] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { aiFitScore: { gte: 80 } } }),
    prisma.prospect.count({
      where: { currentCrmStatus: { in: ["contacted", "replied", "demo_scheduled"] } },
    }),
    prisma.prospect.aggregate({ _avg: { aiFitScore: true } }),
  ])

  const avgFitScore = avgFitRaw._avg.aiFitScore
    ? Math.round(avgFitRaw._avg.aiFitScore)
    : null

  const hasFilters = !!(search || industry || status || score)

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospects</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {totalCount} total prospect{totalCount !== 1 ? "s" : ""}
            {hasFilters && prospects.length !== totalCount && (
              <span className="text-gray-500"> · {prospects.length} shown after filters</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/super-admin/crm/prospects/discover"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Compass className="w-4 h-4" />
            Discover Prospects
          </Link>
          <AddProspectButton />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Prospects"
          value={totalCount}
          icon={<Building2 className="w-4 h-4" />}
          color="gray"
        />
        <StatCard
          label="High Fit (≥80)"
          value={highFitCount}
          icon={<TrendingUp className="w-4 h-4" />}
          color="green"
        />
        <StatCard
          label="Contacted"
          value={contactedCount}
          icon={<Users className="w-4 h-4" />}
          color="blue"
        />
        <StatCard
          label="Avg Fit Score"
          value={avgFitScore !== null ? String(avgFitScore) : "—"}
          icon={<TrendingUp className="w-4 h-4" />}
          color={avgFitScore !== null && avgFitScore >= 80 ? "green" : avgFitScore !== null && avgFitScore >= 60 ? "amber" : "gray"}
        />
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Search company</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Company name…"
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        {/* Industry */}
        <div className="min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Industry</label>
          <select
            name="industry"
            defaultValue={industry}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
          >
            <option value="">All industries</option>
            {INDUSTRY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Status</label>
          <select
            name="status"
            defaultValue={status}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as ProspectCrmStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Fit score */}
        <div className="min-w-[150px]">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Fit score</label>
          <select
            name="score"
            defaultValue={score}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
          >
            <option value="">All scores</option>
            <option value="80+">80+ (High)</option>
            <option value="60-79">60–79 (Medium)</option>
            <option value="<60">&lt;60 (Low)</option>
          </select>
        </div>

        <div className="flex gap-2 pb-0.5">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Filter
          </button>
          {hasFilters && (
            <Link
              href="/super-admin/crm/prospects"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Table or empty state */}
      {prospects.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Industry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Locations</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Fit Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Last Outreach</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {prospects.map(p => {
                  const fit     = fitScoreBadge(p.aiFitScore)
                  const contact = p.contacts[0] ?? null

                  let sizeLabel = "Unknown"
                  if (p.employeeCountMin !== null || p.employeeCountMax !== null) {
                    if (p.employeeCountMin !== null && p.employeeCountMax !== null) {
                      sizeLabel = `${p.employeeCountMin}–${p.employeeCountMax}`
                    } else if (p.employeeCountMin !== null) {
                      sizeLabel = `${p.employeeCountMin}+`
                    } else {
                      sizeLabel = `Up to ${p.employeeCountMax}`
                    }
                  }

                  return (
                    <tr key={p.id} className="hover:bg-gray-800/30 transition-colors group">
                      {/* Company */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <Link
                            href={`/super-admin/crm/prospects/${p.id}`}
                            className="font-medium text-white group-hover:text-indigo-300 transition-colors leading-snug"
                          >
                            {p.companyName}
                          </Link>
                          {p.website && (
                            <a
                              href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors"
                            >
                              <Globe className="w-3 h-3" />
                              {p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Industry */}
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {p.industry ?? <span className="text-gray-600">—</span>}
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {sizeLabel === "Unknown"
                          ? <span className="text-gray-600">Unknown</span>
                          : <span className="flex items-center gap-1"><Users className="w-3 h-3 text-gray-500" />{sizeLabel}</span>
                        }
                      </td>

                      {/* Locations */}
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {p.locationsCount != null
                          ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-500" />{p.locationsCount}</span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>

                      {/* Fit Score */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold tabular-nums ${fit.className}`}>
                          {fit.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${STATUS_COLORS[p.currentCrmStatus]}`}>
                          {STATUS_LABELS[p.currentCrmStatus]}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        {contact ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-200 text-xs leading-snug">{contact.name}</span>
                            {contact.email && (
                              <span className="text-gray-500 text-xs truncate max-w-[160px]">{contact.email}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Last Outreach */}
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {relativeDate(p.lastOutreachDate)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/super-admin/crm/prospects/${p.id}`}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors opacity-0 group-hover:opacity-100"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type StatColor = "gray" | "green" | "blue" | "amber" | "red"

const STAT_COLORS: Record<StatColor, { border: string; icon: string; value: string }> = {
  gray:  { border: "border-gray-700",  icon: "text-gray-400",  value: "text-gray-200"  },
  green: { border: "border-green-700", icon: "text-green-400", value: "text-green-300" },
  blue:  { border: "border-blue-700",  icon: "text-blue-400",  value: "text-blue-300"  },
  amber: { border: "border-amber-700", icon: "text-amber-400", value: "text-amber-300" },
  red:   { border: "border-red-700",   icon: "text-red-400",   value: "text-red-300"   },
}

function StatCard({ label, value, icon, color }: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: StatColor
}) {
  const c = STAT_COLORS[color]
  return (
    <div className={`bg-gray-900 border-l-4 border border-gray-800 ${c.border} rounded-xl px-5 py-4`}>
      <div className={`${c.icon}`}>{icon}</div>
      <p className={`text-2xl font-bold mt-2 leading-none tabular-nums ${c.value}`}>{value}</p>
      <p className="text-xs font-medium text-gray-400 mt-1.5">{label}</p>
    </div>
  )
}

function AddProspectButton() {
  // Simple link to a future add form — keeping it a server component
  return (
    <Link
      href="/super-admin/crm/prospects/new"
      className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
    >
      <Plus className="w-4 h-4" />
      Add Prospect
    </Link>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl py-20 text-center">
      <Building2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
      {hasFilters ? (
        <>
          <p className="text-white font-semibold text-lg">No prospects match your filters</p>
          <p className="text-gray-500 text-sm mt-2 mb-6">Try adjusting or clearing your search filters.</p>
          <Link
            href="/super-admin/crm/prospects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            Clear filters
          </Link>
        </>
      ) : (
        <>
          <p className="text-white font-semibold text-lg">No prospects yet</p>
          <p className="text-gray-500 text-sm mt-2 mb-6">
            Use the AI discovery tool to find companies that are a great fit for Relay.
          </p>
          <Link
            href="/super-admin/crm/prospects/discover"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Compass className="w-4 h-4" />
            Discover your first prospects
          </Link>
        </>
      )}
    </div>
  )
}
