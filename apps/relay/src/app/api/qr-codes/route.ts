import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const VALID_MODES         = ["PUBLIC_ISSUE", "EMPLOYEE_REPORTING", "ASSET_REPORTING", "VISITOR_FEEDBACK", "SAFETY_REPORTING"]
const VALID_CATEGORIES    = ["GENERAL", "EQUIPMENT_BREAKDOWN", "SAFETY", "MAINTENANCE", "VEHICLE", "FACILITY"]
const VALID_ROUTING       = ["AUTO", "MANUAL"]
const VALID_PRESENTATION  = ["DIRECT", "MENU"]
const VALID_ACTIONS       = ["ISSUE", "FEEDBACK", "SURVEY", "ASSET_VIEW"]

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

const INCLUDE = {
  location:   { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  asset:      { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, role: true, isActive: true } },
  survey:     { select: { id: true, title: true } },
  _count:     { select: { submissions: true } },
} as const

export async function GET() {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const qrCodes = await prisma.qrCode.findMany({
    where:   { organizationId: session.organizationId },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ qrCodes: qrCodes.map(buildResponseShape) })
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
    presentationMode?:   string
    enabledActions?:     string[]
    surveyId?:           string | null
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

  const presentationMode = body.presentationMode ?? "DIRECT"
  if (!VALID_PRESENTATION.includes(presentationMode)) {
    return NextResponse.json({ error: "Invalid presentation mode" }, { status: 400 })
  }

  const enabledActions = body.enabledActions ?? []
  const invalidActions = enabledActions.filter(a => !VALID_ACTIONS.includes(a))
  if (invalidActions.length > 0) {
    return NextResponse.json({ error: `Invalid actions: ${invalidActions.join(", ")}` }, { status: 400 })
  }

  // FEEDBACK action requires customer_voice_enabled
  if (enabledActions.includes("FEEDBACK")) {
    const org = await prisma.organization.findUnique({
      where:  { id: session.organizationId },
      select: { customer_voice_enabled: true },
    })
    if (!org?.customer_voice_enabled) {
      return NextResponse.json({ error: "Customer Feedback action requires Customer Voice to be enabled for this organization" }, { status: 400 })
    }
  }

  // Validate surveyId when SURVEY action is present
  const surveyId = body.surveyId ?? null
  if (enabledActions.includes("SURVEY") && surveyId) {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, organizationId: session.organizationId },
      select: { id: true },
    })
    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 400 })
    }
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
      presentationMode,
      enabledActions,
      surveyId,
    },
    include: INCLUDE,
  })

  return NextResponse.json({ qrCode: buildResponseShape(qrCode) }, { status: 201 })
}
