import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Bug, ChevronRight } from "lucide-react"
import { BugReportStatusFilter } from "./status-filter"

export const dynamic = "force-dynamic"

const STATUS_COLOR: Record<string, string> = {
  new:           "bg-red-900/60 text-red-300 border-red-800",
  investigating: "bg-amber-900/60 text-amber-300 border-amber-800",
  fixed:         "bg-green-900/60 text-green-300 border-green-800",
  closed:        "bg-gray-800 text-gray-400 border-gray-700",
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high:     "bg-orange-500 text-white",
  medium:   "bg-amber-500 text-white",
  low:      "bg-green-600 text-white",
}

export default async function BugReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const { status, q } = await searchParams
  const activeStatus = status ?? "all"

  const where: Record<string, unknown> = {}
  if (activeStatus !== "all") where.status = activeStatus
  if (q) {
    where.OR = [
      { orgName:         { contains: q, mode: "insensitive" } },
      { submittedByName: { contains: q, mode: "insensitive" } },
      { description:     { contains: q, mode: "insensitive" } },
      { ticketNumber:    { contains: q, mode: "insensitive" } },
    ]
  }

  const reports = await prisma.bugReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id:              true,
      ticketNumber:    true,
      orgName:         true,
      orgPlan:         true,
      submittedByName: true,
      submittedByRole: true,
      description:     true,
      aiSeverity:      true,
      aiDiagnosis:     true,
      status:          true,
      createdAt:       true,
    },
  })

  const counts = await prisma.bugReport.groupBy({
    by:    ["status"],
    _count: { id: true },
  })
  const countMap = Object.fromEntries(counts.map(c => [c.status, c._count.id]))
  const total = Object.values(countMap).reduce((a, b) => a + b, 0)

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Bug className="w-5 h-5 text-red-400" />
        <h1 className="text-xl font-bold text-white">Bug Reports</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-800 font-medium">
          {countMap["new"] ?? 0} new
        </span>
      </div>

      {/* Filters */}
      <Suspense>
        <BugReportStatusFilter activeStatus={activeStatus} countMap={countMap} total={total} />
      </Suspense>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No bug reports found.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {reports.map(r => (
              <Link
                key={r.id}
                href={`/super-admin/bug-reports/${r.id}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-gray-400">{r.ticketNumber}</span>
                    {r.aiSeverity && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${SEVERITY_COLOR[r.aiSeverity] ?? SEVERITY_COLOR.low}`}>
                        {r.aiSeverity}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[r.status] ?? STATUS_COLOR.new}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium truncate mb-0.5">{r.description}</p>
                  {r.aiDiagnosis && (
                    <p className="text-xs text-gray-400 truncate">{r.aiDiagnosis}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {r.orgName} · {r.submittedByName} ({r.submittedByRole}) · {format(new Date(r.createdAt), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
