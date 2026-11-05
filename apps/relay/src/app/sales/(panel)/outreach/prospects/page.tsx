import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Building2, ExternalLink, Star, Compass, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { AddProspectModal } from "./AddProspectModal"
import { ProspectSearchBar } from "./ProspectSearchBar"
import type { ProspectCrmStatus } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

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

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "fit_desc",     label: "AI Fit (High → Low)" },
  { value: "fit_asc",      label: "AI Fit (Low → High)" },
  { value: "recent_desc",  label: "Newest First" },
  { value: "recent_asc",   label: "Oldest First" },
  { value: "outreach_desc", label: "Last Outreach (Recent)" },
  { value: "name_asc",     label: "Company A → Z" },
]

const PAGE_SIZE = 50

function buildOrderBy(sort: string) {
  switch (sort) {
    case "fit_asc":       return [{ aiFitScore: "asc" as const },   { createdAt: "desc" as const }]
    case "recent_asc":    return [{ createdAt: "asc" as const }]
    case "recent_desc":   return [{ createdAt: "desc" as const }]
    case "outreach_desc": return [{ lastOutreachDate: "desc" as const }, { createdAt: "desc" as const }]
    case "name_asc":      return [{ companyName: "asc" as const }]
    default:              return [{ aiFitScore: "desc" as const },   { createdAt: "desc" as const }]
  }
}

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const isManager = session?.superAdmin || session?.salesUserRole === "admin_sales"
  const repFilter = isManager ? {} : { assignedToId: session?.salesUserId ?? "" }

  const params  = await searchParams
  const search  = typeof params.q      === "string" ? params.q.trim()   : ""
  const status  = typeof params.status === "string" ? params.status       : ""
  const sort    = typeof params.sort   === "string" ? params.sort         : "fit_desc"
  const page    = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10))
  const skip    = (page - 1) * PAGE_SIZE

  const where = {
    ...repFilter,
    ...(status ? { currentCrmStatus: status as ProspectCrmStatus } : {}),
    ...(search ? {
      OR: [
        { companyName: { contains: search, mode: "insensitive" as const } },
        { industry:    { contains: search, mode: "insensitive" as const } },
        { headquartersCity:  { contains: search, mode: "insensitive" as const } },
        { headquartersState: { contains: search, mode: "insensitive" as const } },
        { contacts: { some: { email: { contains: search, mode: "insensitive" as const } } } },
      ],
    } : {}),
  }

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: buildOrderBy(sort),
      skip,
      take: PAGE_SIZE,
      select: {
        id:                true,
        companyName:       true,
        website:           true,
        industry:          true,
        headquartersCity:  true,
        headquartersState: true,
        aiFitScore:        true,
        currentCrmStatus:  true,
        lastOutreachDate:  true,
        createdAt:         true,
        duplicateFlag:     true,
        contacts: {
          take: 1,
          select: { name: true, title: true, email: true },
        },
      },
    }),
    prisma.prospect.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function pageUrl(p: number) {
    const sp = new URLSearchParams()
    if (search) sp.set("q", search)
    if (status) sp.set("status", status)
    if (sort && sort !== "fit_desc") sp.set("sort", sort)
    sp.set("page", String(p))
    return `/sales/outreach/prospects?${sp.toString()}`
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3" data-tour="rep-research-hint">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospects</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {total.toLocaleString()} {status ? STATUS_LABELS[status] ?? status : "total"}
            {search ? ` matching "${search}"` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AddProspectModal />
          <Link
            href="/sales/outreach/prospects/discover"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            Find New Prospects
          </Link>
          <Link
            href="/super-admin/crm/prospects"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full Prospects DB
          </Link>
        </div>
      </div>

      {/* Search + Filter bar (client component for input interactivity) */}
      <ProspectSearchBar
        initialSearch={search}
        currentStatus={status}
        currentSort={sort}
        statusOptions={Object.entries(STATUS_LABELS)}
        sortOptions={SORT_OPTIONS}
      />

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Industry</th>
                <th className="text-left px-4 py-3 font-medium">AI Fit</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Last Outreach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {prospects.map(p => {
                const style = STATUS_STYLES[p.currentCrmStatus] ?? { text: "text-gray-400", bg: "bg-gray-800/60" }
                const contact = p.contacts[0]
                return (
                  <tr key={p.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="px-4 py-3">
                      <Link href={`/sales/outreach/prospects/${p.id}`} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center shrink-0">
                          <Building2 className="w-3 h-3 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                            {p.companyName}
                            {p.duplicateFlag && (
                              <span title="Flagged for admin review — possible duplicate">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                              </span>
                            )}
                          </p>
                          {p.website && (
                            <p className="text-xs text-gray-600">{p.website.replace(/^https?:\/\//, "")}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {contact ? (
                        <>
                          <p className="text-gray-300">{contact.name}</p>
                          <p className="text-xs text-gray-600">{contact.title ?? ""}</p>
                        </>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{p.industry ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.aiFitScore != null ? (
                        <div className="flex items-center gap-1">
                          <Star className={`w-3.5 h-3.5 ${p.aiFitScore >= 80 ? "text-yellow-400" : "text-gray-600"}`} />
                          <span className={`text-sm font-semibold ${p.aiFitScore >= 80 ? "text-yellow-400" : "text-gray-400"}`}>
                            {p.aiFitScore}
                          </span>
                        </div>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {STATUS_LABELS[p.currentCrmStatus] ?? p.currentCrmStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.lastOutreachDate
                        ? formatDistanceToNow(p.lastOutreachDate, { addSuffix: true })
                        : "Never"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {prospects.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">
              {search || status ? "No prospects match your filters." : "No prospects yet."}
            </p>
            {(search || status) && (
              <Link href="/sales/outreach/prospects" className="text-xs text-emerald-500 hover:text-emerald-400 mt-1 block">
                Clear filters
              </Link>
            )}
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={pageUrl(page - 1)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              ) : (
                <span className="p-1.5 text-gray-700"><ChevronLeft className="w-4 h-4" /></span>
              )}
              <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
              {page < totalPages ? (
                <Link href={pageUrl(page + 1)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <span className="p-1.5 text-gray-700"><ChevronRight className="w-4 h-4" /></span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
