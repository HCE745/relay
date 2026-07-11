import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { AssignmentDetailClient } from "@/components/assignments/assignment-detail-client"

export const dynamic = "force-dynamic"

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params

  const assignment = await prisma.assignment.findFirst({
    where: { id, orgId: session.organizationId },
    include: {
      assignee:     { select: { id: true, name: true, role: true } },
      assignedBy:   { select: { id: true, name: true } },
      linkedIssue:  { select: { id: true, title: true, status: true } },
      linkedAsset:  { select: { id: true, name: true } },
      linkedVendor: { select: { id: true, name: true } },
      linkedSop:    { select: { id: true, title: true } },
      comments:     {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!assignment) notFound()

  const isAssignee = assignment.assigneeId === session.userId
  const isManager  = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/assignments" className="hover:text-gray-700 dark:hover:text-gray-300">Assignments</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white">{assignment.title}</span>
      </div>

      <AssignmentDetailClient
        assignment={assignment as never}
        userId={session.userId}
        isAssignee={isAssignee}
        isManager={isManager}
      />
    </div>
  )
}
