import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const assignment = await prisma.assignment.findFirst({
    where: { id, orgId: session.organizationId },
    include: {
      assignee:     { select: { id: true, name: true, role: true } },
      assignedBy:   { select: { id: true, name: true } },
      linkedIssue:  { select: { id: true, title: true, status: true, priority: true } },
      linkedAsset:  { select: { id: true, name: true, status: true } },
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

  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ assignment })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const existing = await prisma.assignment.findFirst({
    where: { id, orgId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Assignee can update status/notes; managers+ can update everything
  const isAssignee  = existing.assigneeId === session.userId
  const isManager   = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!isAssignee && !isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const newStatus = body.status as string | undefined
  const updated = await prisma.assignment.update({
    where: { id },
    data: {
      ...(isManager ? {
        title:          body.title          as string | undefined,
        description:    body.description    as string | undefined,
        priority:       body.priority       as never  | undefined,
        assigneeId:     body.assigneeId     as string | undefined,
        dueDate:        body.dueDate ? new Date(body.dueDate as string) : undefined,
        linkedIssueId:  body.linkedIssueId  as string | undefined,
        linkedAssetId:  body.linkedAssetId  as string | undefined,
        linkedVendorId: body.linkedVendorId as string | undefined,
        linkedSopId:    body.linkedSopId    as string | undefined,
      } : {}),
      ...(newStatus ? { status: newStatus as never } : {}),
      ...(body.notes !== undefined ? { notes: body.notes as string } : {}),
      ...(newStatus === "completed" ? { completedAt: new Date() } : {}),
    },
    include: {
      assignee:   { select: { id: true, name: true } },
      assignedBy: { select: { id: true, name: true } },
    },
  })

  // Record status change
  if (newStatus && newStatus !== existing.status) {
    await prisma.assignmentStatusHistory.create({
      data: {
        assignmentId: id,
        fromStatus:   existing.status,
        toStatus:     newStatus as never,
        changedById:  session.userId,
        note:         body.statusNote as string | undefined,
      },
    })

    // Notify assigner on completion
    if (newStatus === "completed" && existing.assignedById !== session.userId) {
      await prisma.notification.create({
        data: {
          userId:         existing.assignedById,
          organizationId: session.organizationId,
          type:           "ASSIGNMENT_COMPLETED",
          title:          "Assignment Completed",
          message:        `${session.name} completed: ${existing.title}`,
        },
      })
    }
  }

  return NextResponse.json({ assignment: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canDelete = ["ADMIN", "MANAGER"].includes(session.role)
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await prisma.assignment.deleteMany({ where: { id, orgId: session.organizationId } })
  return NextResponse.json({ ok: true })
}
