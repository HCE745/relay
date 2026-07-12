import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Plus, ClipboardCheck, AlertTriangle, Clock, CheckCircle2 } from "lucide-react"

export const dynamic = "force-dynamic"

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const STATUS_COLOR: Record<string, string> = {
  pending:      "text-gray-500 dark:text-gray-400",
  acknowledged: "text-blue-600 dark:text-blue-400",
  in_progress:  "text-yellow-600 dark:text-yellow-400",
  completed:    "text-green-600 dark:text-green-400",
  cancelled:    "text-gray-400 dark:text-gray-600",
}

const STATUS_ICON: Record<string, React.ElementType> = {
  pending:      Clock,
  acknowledged: ClipboardCheck,
  in_progress:  AlertTriangle,
  completed:    CheckCircle2,
  cancelled:    Clock,
}

function formatDate(d: Date | null) {
  if (!d) return null
  const date = new Date(d)
  const now  = new Date()
  const diff = date.getTime() - now.getTime()
  const days = Math.round(diff / 86400000)
  if (days < 0)   return { label: `${Math.abs(days)}d overdue`, overdue: true }
  if (days === 0) return { label: "Due today", overdue: false }
  if (days === 1) return { label: "Due tomorrow", overdue: false }
  return { label: `Due ${date.toLocaleDateString()}`, overdue: false }
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const sp        = await searchParams
  const statusFilter = sp.status   ?? ""
  const mineOnly     = sp.mine === "true"

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  const assignments = await prisma.assignment.findMany({
    where: {
      orgId:      session.organizationId,
      ...(statusFilter ? { status: statusFilter as never } : { status: { not: "cancelled" as never } }),
      ...(mineOnly     ? { assigneeId: session.userId }    : {}),
    },
    include: {
      assignee:   { select: { id: true, name: true } },
      assignedBy: { select: { id: true, name: true } },
      linkedIssue:  { select: { id: true, title: true } },
      linkedAsset:  { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  })

  const open      = assignments.filter(a => !["completed", "cancelled"].includes(a.status))
  const completed = assignments.filter(a => a.status === "completed")

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Assignments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {open.length} open · {completed.length} completed
          </p>
        </div>
        {canCreate && (
          <Link
            href="/assignments/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assignment
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["", "pending", "acknowledged", "in_progress", "completed", "cancelled"] as const).map(s => (
          <Link
            key={s}
            href={`/assignments?status=${s}${mineOnly ? "&mine=true" : ""}`}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400"
            )}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </Link>
        ))}
        <div className="ml-auto">
          <Link
            href={`/assignments?${statusFilter ? `status=${statusFilter}&` : ""}mine=${mineOnly ? "false" : "true"}`}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              mineOnly
                ? "bg-gray-800 text-white border-gray-800"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400"
            )}
          >
            {mineOnly ? "My assignments" : "Mine only"}
          </Link>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No assignments found</p>
          {canCreate && (
            <Link href="/assignments/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Create the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2" data-tour="assignment-list">
          {assignments.map(a => {
            const StatusIcon = STATUS_ICON[a.status] ?? Clock
            const due = formatDate(a.dueDate)
            return (
              <Link
                key={a.id}
                href={`/assignments/${a.id}`}
                className="block bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", STATUS_COLOR[a.status])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {a.title}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", PRIORITY_COLOR[a.priority])}>
                        {a.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <span>{a.assignee.name}</span>
                      {due && (
                        <span className={due.overdue ? "text-red-500 font-medium" : ""}>{due.label}</span>
                      )}
                      {a.linkedIssue && <span>Issue: {a.linkedIssue.title}</span>}
                      {a.linkedAsset && <span>Asset: {a.linkedAsset.name}</span>}
                      {a._count.comments > 0 && (
                        <span>{a._count.comments} comment{a._count.comments !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 capitalize">{a.status.replace("_", " ")}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
