import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push-notifications"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status     = searchParams.get("status")     ?? undefined
  const assigneeId = searchParams.get("assigneeId") ?? undefined
  const priority   = searchParams.get("priority")   ?? undefined
  const mine       = searchParams.get("mine") === "true"

  const assignments = await prisma.assignment.findMany({
    where: {
      orgId: session.organizationId,
      ...(status     ? { status:     status as never }     : {}),
      ...(priority   ? { priority:   priority as never }   : {}),
      ...(assigneeId ? { assigneeId }                      : {}),
      ...(mine       ? { assigneeId: session.userId }      : {}),
    },
    include: {
      assignee:   { select: { id: true, name: true, role: true } },
      assignedBy: { select: { id: true, name: true } },
      linkedIssue:  { select: { id: true, title: true, status: true } },
      linkedAsset:  { select: { id: true, name: true } },
      linkedVendor: { select: { id: true, name: true } },
      linkedSop:    { select: { id: true, title: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ assignments })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!canCreate) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  const body = await req.json() as {
    title:          string
    description?:   string
    priority?:      string
    assigneeId:     string
    dueDate?:       string
    linkedIssueId?:  string
    linkedAssetId?:  string
    linkedVendorId?: string
    linkedSopId?:    string
    notes?:         string
  }

  if (!body.title?.trim())    return NextResponse.json({ error: "Title required" }, { status: 400 })
  if (!body.assigneeId)       return NextResponse.json({ error: "Assignee required" }, { status: 400 })

  const assignment = await prisma.assignment.create({
    data: {
      orgId:          session.organizationId,
      title:          body.title.trim(),
      description:    body.description,
      priority:       (body.priority as never) ?? "medium",
      assigneeId:     body.assigneeId,
      assignedById:   session.userId,
      dueDate:        body.dueDate ? new Date(body.dueDate) : undefined,
      linkedIssueId:  body.linkedIssueId  ?? undefined,
      linkedAssetId:  body.linkedAssetId  ?? undefined,
      linkedVendorId: body.linkedVendorId ?? undefined,
      linkedSopId:    body.linkedSopId    ?? undefined,
      notes:          body.notes,
    },
    include: {
      assignee:   { select: { id: true, name: true } },
      assignedBy: { select: { id: true, name: true } },
    },
  })

  // Status history entry
  await prisma.assignmentStatusHistory.create({
    data: {
      assignmentId: assignment.id,
      toStatus:     "pending",
      changedById:  session.userId,
      note:         "Assignment created",
    },
  })

  // In-app notification for assignee
  await prisma.notification.create({
    data: {
      userId:         body.assigneeId,
      organizationId: session.organizationId,
      type:           "ASSIGNMENT_CREATED",
      title:          "New Assignment",
      message:        `${session.name} assigned you: ${body.title}`,
    },
  })

  // Push notification
  sendPushNotification(body.assigneeId, "New Assignment", `${session.name}: ${body.title}`, {
    type:         "ASSIGNMENT_CREATED",
    assignmentId: assignment.id,
  }).catch(() => {})

  return NextResponse.json({ assignment }, { status: 201 })
}
