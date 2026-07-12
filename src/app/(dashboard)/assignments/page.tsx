import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Plus, ClipboardCheck } from "lucide-react"
import { Header } from "@/components/layout/header"
import { AssignmentsListClient } from "@/components/assignments/assignments-list-client"

export const dynamic = "force-dynamic"


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
    <div>
      <Header title="Assignments" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between md:hidden">
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
            New
          </Link>
        )}
      </div>

      {/* Status / mine filters */}
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

      <AssignmentsListClient assignments={assignments as never} canCreate={canCreate} />
      </div>
    </div>
  )
}
