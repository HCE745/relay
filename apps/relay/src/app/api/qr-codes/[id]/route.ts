import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const VALID_MODES         = ["PUBLIC_ISSUE", "EMPLOYEE_REPORTING", "ASSET_REPORTING", "VISITOR_FEEDBACK", "SAFETY_REPORTING"]
const VALID_CATEGORIES    = ["GENERAL", "EQUIPMENT_BREAKDOWN", "SAFETY", "MAINTENANCE", "VEHICLE", "FACILITY"]
const VALID_ROUTING       = ["AUTO", "MANUAL"]
const VALID_PRESENTATION  = ["DIRECT", "MENU"]
const VALID_ACTIONS       = ["ISSUE", "FEEDBACK", "SURVEY", "ASSET_VIEW"]

const INCLUDE = {
  location:   { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  asset:      { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, role: true, isActive: true } },
  survey:     { select: { id: true, title: true } },
  _count:     { select: { submissions: true } },
} as const

function buildResponseShape(qrCode: {
  id: string; name: string; description: string | null; token: string
  reportingMode: string; routingMode: string; assignedToId: string | null
  locationId: string | null; area: string | null; departmentId: string | null
  assetId: string | null; defaultCategory: string; allowedCategories: string[]
  collectContactInfo: boolean; requireContactInfo: boolean; requirePhoto: boolean
  isActive: boolean; presentationMode: string; enabledActions: string[]
  surveyId: string | null; createdAt: Date
  location:   { name: string } | null
  department: { name: string } | null
  asset:      { name: string } | null
  assignedTo: { name: string; role: string; isActive: boolean } | null
  survey:     { id: string; title: string } | null
  _count: { submissions: number }
}) {
  return {
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
    assetId:            qrCode.assetId,
    assetName:          qrCode.asset?.name ?? null,
    defaultCategory:    qrCode.defaultCategory,
    allowedCategories:  qrCode.allowedCategories,
    collectContactInfo: qrCode.collectContactInfo,
    requireContactInfo: qrCode.requireContactInfo,
    requirePhoto:       qrCode.requirePhoto,
    isActive:           qrCode.isActive,
    presentationMode:   qrCode.presentationMode,
    enabledActions:     qrCode.enabledActions,
    surveyId:           qrCode.surveyId,
    surveyTitle:        qrCode.survey?.title ?? null,
    submissionCount:    qrCode._count.submissions,
    createdAt:          qrCode.createdAt.toISOString(),
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existing = await prisma.qrCode.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.organizationId !== session.organizationId) {
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
    assetId?:            string | null
    defaultCategory?:    string
    allowedCategories?:  string[]
    collectContactInfo?: boolean
    requireContactInfo?: boolean
    requirePhoto?:       boolean
    presentationMode?:   string
    enabledActions?:     string[]
    surveyId?:           string | null
  }

  if (body.reportingMode   !== undefined && !VALID_MODES.includes(body.reportingMode)) {
    return NextResponse.json({ error: "Invalid reporting mode" }, { status: 400 })
  }
  if (body.defaultCategory !== undefined && !VALID_CATEGORIES.includes(body.defaultCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }
  if (body.routingMode     !== undefined && !VALID_ROUTING.includes(body.routingMode)) {
    return NextResponse.json({ error: "Invalid routing mode" }, { status: 400 })
  }
  if (body.presentationMode !== undefined && !VALID_PRESENTATION.includes(body.presentationMode)) {
    return NextResponse.json({ error: "Invalid presentation mode" }, { status: 400 })
  }
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
  }

  if (body.enabledActions !== undefined) {
    const invalid = body.enabledActions.filter(a => !VALID_ACTIONS.includes(a))
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid actions: ${invalid.join(", ")}` }, { status: 400 })
    }
    if (body.enabledActions.includes("FEEDBACK")) {
      const org = await prisma.organization.findUnique({
        where:  { id: session.organizationId },
        select: { customer_voice_enabled: true },
      })
      if (!org?.customer_voice_enabled) {
        return NextResponse.json({ error: "Customer Feedback action requires Customer Voice to be enabled" }, { status: 400 })
      }
    }
  }

  // Validate surveyId if provided
  if (body.surveyId) {
    const survey = await prisma.survey.findFirst({
      where: { id: body.surveyId, organizationId: session.organizationId },
      select: { id: true },
    })
    if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 400 })
  }

  if (body.routingMode === "MANUAL" && body.assignedToId !== undefined) {
    if (!body.assignedToId) {
      return NextResponse.json({ error: "A person must be selected for manual routing" }, { status: 400 })
    }
    const assignee = await prisma.user.findFirst({
      where: { id: body.assignedToId, organizationId: session.organizationId },
      select: { id: true },
    })
    if (!assignee) return NextResponse.json({ error: "Selected person not found" }, { status: 400 })
  }

  const resolvedAssignedToId =
    body.routingMode === "AUTO"    ? null :
    body.routingMode === "MANUAL"  ? (body.assignedToId ?? undefined) :
    body.assignedToId !== undefined ? body.assignedToId : undefined

  const updated = await prisma.qrCode.update({
    where: { id },
    data: {
      ...(body.name              !== undefined ? { name:               body.name.trim() }                : {}),
      ...(body.description       !== undefined ? { description:        body.description?.trim() ?? null } : {}),
      ...(body.isActive          !== undefined ? { isActive:           body.isActive }                    : {}),
      ...(body.reportingMode     !== undefined ? { reportingMode:      body.reportingMode }               : {}),
      ...(body.routingMode       !== undefined ? { routingMode:        body.routingMode }                 : {}),
      ...(resolvedAssignedToId   !== undefined ? { assignedToId:       resolvedAssignedToId }             : {}),
      ...(body.locationId        !== undefined ? { locationId:         body.locationId }                  : {}),
      ...(body.area              !== undefined ? { area:               body.area?.trim() ?? null }        : {}),
      ...(body.departmentId      !== undefined ? { departmentId:       body.departmentId }                : {}),
      ...(body.assetId           !== undefined ? { assetId:            body.assetId }                     : {}),
      ...(body.defaultCategory   !== undefined ? { defaultCategory:    body.defaultCategory }             : {}),
      ...(body.allowedCategories !== undefined ? { allowedCategories:  body.allowedCategories }           : {}),
      ...(body.collectContactInfo !== undefined ? { collectContactInfo: body.collectContactInfo }          : {}),
      ...(body.requireContactInfo !== undefined ? { requireContactInfo: body.requireContactInfo }          : {}),
      ...(body.requirePhoto       !== undefined ? { requirePhoto:       body.requirePhoto }                : {}),
      ...(body.presentationMode   !== undefined ? { presentationMode:   body.presentationMode }           : {}),
      ...(body.enabledActions     !== undefined ? { enabledActions:     body.enabledActions }             : {}),
      ...(body.surveyId           !== undefined ? { surveyId:           body.surveyId }                   : {}),
    },
    include: INCLUDE,
  })

  return NextResponse.json({ qrCode: buildResponseShape(updated) })
}
