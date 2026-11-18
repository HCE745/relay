import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Building2, MapPin, Users, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_LABELS: Record<string, string> = {
  researched:      "Researched",
  contacted:       "Contacted",
  replied:         "Replied",
  demo_scheduled:  "Demo Scheduled",
  trial:           "Trial",
  customer:        "Customer",
  not_interested:  "Not Interested",
  do_not_contact:  "Do Not Contact",
}

const STATUS_COLORS: Record<string, string> = {
  researched:      "text-gray-400 bg-gray-800",
  contacted:       "text-blue-400 bg-blue-900/30",
  replied:         "text-purple-400 bg-purple-900/30",
  demo_scheduled:  "text-amber-400 bg-amber-900/30",
  trial:           "text-orange-400 bg-orange-900/30",
  customer:        "text-emerald-400 bg-emerald-900/30",
  not_interested:  "text-red-400 bg-red-900/30",
  do_not_contact:  "text-red-500 bg-red-900/30",
}

const PAGE_SIZE = 25

export default async function RepViewProspectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { repId } = await params
  const { page: pageStr, q } = await searchParams

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const page = Math.max(1, parseInt(pageStr ?? "1", 10))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    assignedToId: repId,
    ...(q ? { companyName: { contains: q, mode: "insensitive" as const } } : {}),
  }

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        industry: true,
        headquartersCity: true,
        headquartersState: true,
        currentCrmStatus: true,
        employeeCountMin: true,
        employeeCountMax: true,
        aiFitScore: true,
        _count: { select: { contacts: true, tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.prospect.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const basePath = `/sales/manager/rep-view/${repId}`

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Prospects</h2>
          <p className="text-xs text-gray-500 mt-0.5">{total} assigned</p>
        </div>
        <form method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search companies…"
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 bg-gray-900 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 w-56"
          />
        </form>
      </div>

      {prospects.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-10 text-center">
          <Building2 className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {q ? "No prospects match that search." : "No prospects assigned."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-800 overflow-hidden divide-y divide-gray-800">
            {prospects.map(p => {
              const statusLabel = STATUS_LABELS[p.currentCrmStatus] ?? p.currentCrmStatus
              const statusColor = STATUS_COLORS[p.currentCrmStatus] ?? "text-gray-400 bg-gray-800"
              const empRange = p.employeeCountMin && p.employeeCountMax
                ? `${p.employeeCountMin}–${p.employeeCountMax} emp`
                : p.employeeCountMin ? `${p.employeeCountMin}+ emp` : null
              return (
                <Link
                  key={p.id}
                  href={`${basePath}/prospects/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 bg-gray-900/40 hover:bg-gray-800/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-white truncate">{p.companyName}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {p.industry && <span>{p.industry}</span>}
                      {(p.headquartersCity || p.headquartersState) && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {[p.headquartersCity, p.headquartersState].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {empRange && (
                        <span className="flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />
                          {empRange}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 shrink-0">
                    {p._count.contacts > 0 && (
                      <span>{p._count.contacts} contact{p._count.contacts !== 1 ? "s" : ""}</span>
                    )}
                    {p._count.tasks > 0 && (
                      <span>{p._count.tasks} task{p._count.tasks !== 1 ? "s" : ""}</span>
                    )}
                    {p.aiFitScore != null && (
                      <span className="text-emerald-600 font-medium">Score {p.aiFitScore}</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0" />
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className="px-3 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-400"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className="px-3 py-1 rounded border border-gray-700 hover:border-gray-500 text-gray-400"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
