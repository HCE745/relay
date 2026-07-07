import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const VALID_MODES       = ["PUBLIC_ISSUE", "EMPLOYEE_REPORTING", "ASSET_REPORTING", "VISITOR_FEEDBACK", "SAFETY_REPORTING"]
const VALID_CATEGORIES  = ["GENERAL", "EQUIPMENT_BREAKDOWN", "SAFETY", "MAINTENANCE", "VEHICLE", "FACILITY"]
const VALID_ROUTING     = ["AUTO", "MANUAL"]

export async function GET() {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const qrCodes = await prisma.qrCode.findMany({
    where: { organizationId: session.organizationId },
    include: {
      location:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      asset:      { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, role: true, isActive: true } },
      _count:     { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ qrCodes })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    name?:               string
    description?:        string | null
    reportingMode?:      string
    routingMode?:        string
    assignedToId?:       string | null
    locationId?:         string | null
    area?:               string | null
    departmentId?:       string | null
    assetId?:            string | null
    defaultCategory?:    string
    allowedCategories?:  string[]
    collectContactInfo?: boolean
    requireContactInfo?: boolean
    requirePhoto?:       boolean
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const reportingMode = body.reportingMode ?? "PUBLIC_ISSUE"
  if (!VALID_MODES.includes(reportingMode)) {
    return NextResponse.json({ error: "Invalid reporting mode" }, { status: 400 })
  }

  const defaultCategory = body.defaultCategory ?? "GENERAL"
  if (!VALID_CATEGORIES.includes(defaultCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const routingMode = body.routingMode ?? "AUTO"
  if (!VALID_ROUTING.includes(routingMode)) {
    return NextResponse.json({ error: "Invalid routing mode" }, { status: 400 })
  }

  const assignedToId = routingMode === "MANUAL" ? (body.assignedToId ?? null) : null
  if (routingMode === "MANUAL" && !assignedToId) {
    return NextResponse.json({ error: "A person must be selected for manual routing" }, { status: 400 })
  }

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, organizationId: session.organizationId },
      select: { id: true },
    })
    if (!assignee) {
      return NextResponse.json({ error: "Selected person not found" }, { status: 400 })
    }
  }

  const qrCode = await prisma.qrCode.create({
    data: {
      organizationId:    session.organizationId,
      createdById:       session.userId,
      name:              body.name.trim(),
      description:       body.description?.trim() ?? null,
      reportingMode,
      routingMode,
      assignedToId,
      locationId:        body.locationId   ?? null,
      area:              body.area?.trim() ?? null,
      departmentId:      body.departmentId ?? null,
      assetId:           body.assetId      ?? null,
      defaultCategory,
      allowedCategories: body.allowedCategories ?? [],
      collectContactInfo: body.collectContactInfo ?? false,
      requireContactInfo: body.requireContactInfo ?? false,
      requirePhoto:       body.requirePhoto        ?? false,
      isActive:           true,
    },
    include: {
      location:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      asset:      { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, role: true, isActive: true } },
      _count:     { select: { submissions: true } },
    },
  })

  const responseQrCode = {
    id:                 qrCode.id,
    name:               qrCode.name,
    description:        qrCode.description,
    token:              qrCode.token,
    reportingMode:      qrCode.reportingMode,
    routingMode:        qrCode.routingMode,
    assignedToId:       qrCode.assignedToId,
    assignedToName:     qrCode.assignedTo?.name     ?? null,
    assignedToRole:     qrCode.assignedTo?.role     ?? null,
    assignedToActive:   qrCode.assignedTo?.isActive ?? true,
    locationId:         qrCode.locationId,
    locationName:       qrCode.location?.name ?? null,
    area:               qrCode.area,
    departmentId:       qrCode.departmentId,
    departmentName:     qrCode.department?.name ?? null,
    defaultCategory:    qrCode.defaultCategory,
    collectContactInfo: qrCode.collectContactInfo,
    requireContactInfo: qrCode.requireContactInfo,
    requirePhoto:       qrCode.requirePhoto,
    isActive:           qrCode.isActive,
    submissionCount:    qrCode._count.submissions,
    createdAt:          qrCode.createdAt.toISOString(),
  }

  return NextResponse.json({ qrCode: responseQrCode }, { status: 201 })
}
