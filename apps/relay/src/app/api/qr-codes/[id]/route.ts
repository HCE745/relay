import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const VALID_MODES      = ["PUBLIC_ISSUE", "EMPLOYEE_REPORTING", "ASSET_REPORTING", "VISITOR_FEEDBACK", "SAFETY_REPORTING"]
const VALID_CATEGORIES = ["GENERAL", "EQUIPMENT_BREAKDOWN", "SAFETY", "MAINTENANCE", "VEHICLE", "FACILITY"]
const VALID_ROUTING    = ["AUTO", "MANUAL"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const qrCode = await prisma.qrCode.findUnique({
    where:  { id },
    select: { organizationId: true },
  })

  if (!qrCode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (qrCode.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    name?:               string
    description?:        string | null
    isActive?:           boolean
    reportingMode?:      string
    routingMode?:        string
    assignedToId?:       string | null
    locationId?:         string | null
    area?:               string | null
    departmentId?:       string | null
    defaultCategory?:    string
    allowedCategories?:  string[]
    collectContactInfo?: boolean
    requireContactInfo?: boolean
    requirePhoto?:       boolean
  }

  if (body.reportingMode !== undefined && !VALID_MODES.includes(body.reportingMode)) {
    return NextResponse.json({ error: "Invalid reporting mode" }, { status: 400 })
  }
  if (body.defaultCategory !== undefined && !VALID_CATEGORIES.includes(body.defaultCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }
  if (body.routingMode !== undefined && !VALID_ROUTING.includes(body.routingMode)) {
    return NextResponse.json({ error: "Invalid routing mode" }, { status: 400 })
  }
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
  }

  if (body.routingMode === "MANUAL" && body.assignedToId !== undefined) {
    if (!body.assignedToId) {
      return NextResponse.json({ error: "A person must be selected for manual routing" }, { status: 400 })
    }
    const assignee = await prisma.user.findFirst({
      where: { id: body.assignedToId, organizationId: session.organizationId },
      select: { id: true },
    })
    if (!assignee) {
      return NextResponse.json({ error: "Selected person not found" }, { status: 400 })
    }
  }

  const resolvedAssignedToId =
    body.routingMode === "AUTO"   ? null :
    body.routingMode === "MANUAL" ? (body.assignedToId ?? undefined) :
    body.assignedToId !== undefined ? body.assignedToId : undefined

  const updated = await prisma.qrCode.update({
    where: { id },
    data: {
      ...(body.name          !== undefined ? { name:               body.name.trim() }                  : {}),
      ...(body.description   !== undefined ? { description:        body.description?.trim() ?? null }   : {}),
      ...(body.isActive      !== undefined ? { isActive:           body.isActive }                      : {}),
      ...(body.reportingMode !== undefined ? { reportingMode:      body.reportingMode }                 : {}),
      ...(body.routingMode   !== undefined ? { routingMode:        body.routingMode }                   : {}),
      ...(resolvedAssignedToId !== undefined ? { assignedToId:     resolvedAssignedToId }               : {}),
      ...(body.locationId    !== undefined ? { locationId:         body.locationId }                    : {}),
      ...(body.area          !== undefined ? { area:               body.area?.trim() ?? null }          : {}),
      ...(body.departmentId  !== undefined ? { departmentId:       body.departmentId }                  : {}),
      ...(body.defaultCategory   !== undefined ? { defaultCategory:   body.defaultCategory }            : {}),
      ...(body.allowedCategories !== undefined ? { allowedCategories: body.allowedCategories }          : {}),
      ...(body.collectContactInfo !== undefined ? { collectContactInfo: body.collectContactInfo }       : {}),
      ...(body.requireContactInfo !== undefined ? { requireContactInfo: body.requireContactInfo }       : {}),
      ...(body.requirePhoto       !== undefined ? { requirePhoto:       body.requirePhoto }             : {}),
    },
    include: {
      location:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, role: true, isActive: true } },
      _count:     { select: { submissions: true } },
    },
  })

  return NextResponse.json({
    qrCode: {
      id:                 updated.id,
      name:               updated.name,
      description:        updated.description,
      token:              updated.token,
      reportingMode:      updated.reportingMode,
      routingMode:        updated.routingMode,
      assignedToId:       updated.assignedToId,
      assignedToName:     updated.assignedTo?.name     ?? null,
      assignedToRole:     updated.assignedTo?.role     ?? null,
      assignedToActive:   updated.assignedTo?.isActive ?? true,
      locationId:         updated.locationId,
      locationName:       updated.location?.name ?? null,
      area:               updated.area,
      departmentId:       updated.departmentId,
      departmentName:     updated.department?.name ?? null,
      defaultCategory:    updated.defaultCategory,
      collectContactInfo: updated.collectContactInfo,
      requireContactInfo: updated.requireContactInfo,
      requirePhoto:       updated.requirePhoto,
      isActive:           updated.isActive,
      submissionCount:    updated._count.submissions,
      createdAt:          updated.createdAt.toISOString(),
    },
  })
}
