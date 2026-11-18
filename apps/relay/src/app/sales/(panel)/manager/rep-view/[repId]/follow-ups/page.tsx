import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Bell, Clock, AlertCircle, CheckCircle2 } from "lucide-react"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "text-red-400 bg-red-900/20 border-red-900/50",
  normal: "text-gray-400 bg-gray-800 border-gray-700",
  low:    "text-gray-600 bg-gray-900 border-gray-800",
}

const TYPE_LABELS: Record<string, string> = {
  call:      "Call",
  email:     "Email",
  linkedin:  "LinkedIn",
  proposal:  "Proposal",
  contract:  "Contract",
  other:     "Other",
}

export default async function RepViewFollowUpsPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>
  searchParams: Promise<{ filter?: string }>
}) {
  const { repId } = await params
  const { filter = "open" } = await searchParams

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const now = new Date()

  const tasks = await prisma.crmTask.findMany({
    where: {
      assignedToId: repId,
      ...(filter === "done"
        ? { completedAt: { not: null } }
        : { completedAt: null }),
    },
    select: {
      id: true,
      title: true,
      taskType: true,
      dueAt: true,
      completedAt: true,
      priority: true,
      notes: true,
      prospect:    { select: { id: true, companyName: true } },
      opportunity: { select: { id: true, title: true } },
    },
    orderBy: filter === "done"
      ? { completedAt: "desc" }
      : [{ dueAt: "asc" }, { priority: "desc" }],
    take: 100,
  })

  const basePath = `/sales/manager/rep-view/${repId}`

  const overdue  = tasks.filter(t => !t.completedAt && t.dueAt && new Date(t.dueAt) < now)
  const upcoming = tasks.filter(t => !t.completedAt && (!t.dueAt || new Date(t.dueAt) >= now))
  const done     = tasks.filter(t => t.completedAt)

  const groups =
    filter === "done"
      ? [{ label: "Completed", tasks: done, icon: CheckCircle2, iconClass: "text-emerald-500" }]
      : [
          { label: "Overdue",  tasks: overdue,  icon: AlertCircle,  iconClass: "text-red-400" },
          { label: "Upcoming", tasks: upcoming, icon: Clock,        iconClass: "text-blue-400" },
        ]

  return (
    <div className="p-6">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6">
        {[
          { key: "open", label: "Open" },
          { key: "done", label: "Completed" },
        ].map(f => (
          <Link
            key={f.key}
            href={`?filter=${f.key}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-gray-700 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-10 text-center">
          <Bell className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {filter === "done" ? "No completed tasks." : "No open tasks."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(g => g.tasks.length > 0 && (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-3">
                <g.icon className={`w-4 h-4 ${g.iconClass}`} />
                <h3 className="text-sm font-semibold text-white">{g.label}</h3>
                <span className="text-xs text-gray-600">({g.tasks.length})</span>
              </div>
              <div className="rounded-lg border border-gray-800 overflow-hidden divide-y divide-gray-800">
                {g.tasks.map(t => {
                  const isOverdue = !t.completedAt && t.dueAt && new Date(t.dueAt) < now
                  const pColor = PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.normal
                  return (
                    <div key={t.id} className="px-5 py-4 bg-gray-900/40">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className={`text-sm font-medium ${t.completedAt ? "text-gray-500 line-through" : "text-white"}`}>
                              {t.title}
                            </p>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                              {TYPE_LABELS[t.taskType] ?? t.taskType}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${pColor}`}>
                              {t.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            {t.prospect && (
                              <Link
                                href={`${basePath}/prospects/${t.prospect.id}`}
                                className="hover:text-gray-300 transition-colors"
                              >
                                {t.prospect.companyName}
                              </Link>
                            )}
                            {t.opportunity && (
                              <Link
                                href={`${basePath}/opportunities/${t.opportunity.id}`}
                                className="hover:text-gray-300 transition-colors"
                              >
                                {t.opportunity.title}
                              </Link>
                            )}
                            {t.dueAt && (
                              <span className={`flex items-center gap-1 ${isOverdue ? "text-red-400" : ""}`}>
                                <Clock className="w-3 h-3" />
                                {isOverdue ? "Overdue · " : "Due "}
                                {fmtDate(t.dueAt)}
                              </span>
                            )}
                            {t.completedAt && (
                              <span className="text-emerald-600">Done {fmtDate(t.completedAt)}</span>
                            )}
                          </div>
                          {t.notes && (
                            <p className="mt-1.5 text-xs text-gray-500 leading-relaxed line-clamp-2">{t.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
