export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { findDuplicateProspect } from "@/lib/prospect-utils"

type RouteCtx = { params: Promise<{ id: string }> }

const PROSPECT_INCLUDE = {
  contacts: { orderBy: { createdAt: "asc" as const } },
  notes: { orderBy: { createdAt: "desc" as const } },
  assignedTo: { select: { id: true, name: true, email: true } },
} as const

// GET /api/sales/prospects/[id]
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const prospect = await prisma.prospect.findUnique({ where: { id }, include: PROSPECT_INCLUDE })
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Reps can only view their own prospects
  if (info.isRep && prospect.assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({ prospect })
}

// PATCH /api/sales/prospects/[id] — update with ownership enforcement
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const prospect = await prisma.prospect.findUnique({ where: { id } })
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Reps can only edit their own prospects
  if (info.isRep && prospect.assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    companyName?: string
    website?: string | null
    industry?: string | null
    employeeCountMin?: number | null
    employeeCountMax?: number | null
    locationsCount?: number | null
    headquartersCity?: string | null
    headquartersState?: string | null
    linkedinUrl?: string | null
    aiFitScore?: number | null
    researchSummary?: string | null
    currentCrmStatus?: string
    assignedToId?: string | null
    reason?: string
    duplicateFlag?: boolean
    duplicateOfId?: string | null
    confirmDuplicate?: boolean
  }

  // Only managers/superAdmins can reassign ownership
  const isReassignment = body.assignedToId !== undefined && body.assignedToId !== prospect.assignedToId
  if (isReassignment && info.isRep) {
    return NextResponse.json(
      { error: "Only managers and admins can reassign prospect ownership." },
      { status: 403 }
    )
  }

  // Duplicate detection if company name is changing
  if (body.companyName && body.companyName !== prospect.companyName && !body.confirmDuplicate) {
    const duplicate = await findDuplicateProspect({
      companyName: body.companyName,
      website: body.website ?? prospect.website,
      excludeId: id,
    })
    if (duplicate) {
      return NextResponse.json(
        {
          warning: "duplicate_detected",
          message: `A prospect named "${duplicate.companyName}" already exists (owned by ${duplicate.assignedToName ?? "unassigned"}).`,
          existing: duplicate,
        },
        { status: 409 }
      )
    }
  }

  const data: Record<string, unknown> = {}
  if (body.companyName         !== undefined) data.companyName         = body.companyName
  if (body.website             !== undefined) data.website             = body.website
  if (body.industry            !== undefined) data.industry            = body.industry
  if (body.employeeCountMin    !== undefined) data.employeeCountMin    = body.employeeCountMin
  if (body.employeeCountMax    !== undefined) data.employeeCountMax    = body.employeeCountMax
  if (body.locationsCount      !== undefined) data.locationsCount      = body.locationsCount
  if (body.headquartersCity    !== undefined) data.headquartersCity    = body.headquartersCity
  if (body.headquartersState   !== undefined) data.headquartersState   = body.headquartersState
  if (body.linkedinUrl         !== undefined) data.linkedinUrl         = body.linkedinUrl
  if (body.aiFitScore          !== undefined) data.aiFitScore          = body.aiFitScore
  if (body.researchSummary     !== undefined) data.researchSummary     = body.researchSummary
  if (body.currentCrmStatus    !== undefined) data.currentCrmStatus    = body.currentCrmStatus
  if (body.duplicateFlag       !== undefined && (info.isManager || info.isSuperAdmin)) {
    data.duplicateFlag = body.duplicateFlag
    data.duplicateOfId = body.duplicateOfId ?? null
  }

  if (isReassignment) {
    const newOwner = body.assignedToId
      ? await prisma.salesUser.findUnique({ where: { id: body.assignedToId }, select: { name: true } })
      : null

    await prisma.accountAssignmentHistory.create({
      data: {
        recordType: "prospect",
        recordId: id,
        previousOwnerId: prospect.assignedToId,
        newOwnerId: body.assignedToId,
        changedById: info.salesUserId ?? "unknown",
        changedByType: info.isSuperAdmin ? "SUPER_ADMIN" : "SALES_USER",
        reason: body.reason ?? null,
      },
    })

    data.assignedToId   = body.assignedToId
    data.assignedToName = newOwner?.name ?? null
  }

  const updated = await prisma.prospect.update({ where: { id }, data, include: PROSPECT_INCLUDE })
  return NextResponse.json({ prospect: updated })
}
