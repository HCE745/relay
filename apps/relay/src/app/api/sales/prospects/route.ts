export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { findDuplicateProspect } from "@/lib/prospect-utils"
import type { ProspectCrmStatus } from "@/generated/prisma/client"

const PROSPECT_SELECT = {
  id: true, companyName: true, website: true, industry: true,
  headquartersCity: true, headquartersState: true, aiFitScore: true,
  currentCrmStatus: true, assignedToId: true, assignedToName: true,
  lastOutreachDate: true, lastReplyDate: true, createdAt: true,
  duplicateFlag: true, duplicateOfId: true,
  contacts: { take: 1, select: { id: true, name: true, title: true, email: true } },
} as const

// GET /api/sales/prospects — list prospects for the current sales user
export async function GET(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200)
  const skip = (page - 1) * limit

  const repFilter = info.isManager || info.isSuperAdmin
    ? {}
    : { assignedToId: info.salesUserId }

  const where = {
    ...repFilter,
    ...(status ? { currentCrmStatus: status as ProspectCrmStatus } : {}),
    ...(search ? {
      OR: [
        { companyName: { contains: search, mode: "insensitive" as const } },
        { industry: { contains: search, mode: "insensitive" as const } },
        { headquartersCity: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({ where, select: PROSPECT_SELECT, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.prospect.count({ where }),
  ])

  return NextResponse.json({ prospects, total, page, limit })
}

// POST /api/sales/prospects — create a prospect with duplicate detection
export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    companyName: string
    website?: string | null
    industry?: string | null
    employeeCountMin?: number | null
    employeeCountMax?: number | null
    locationsCount?: number | null
    headquartersCity?: string | null
    headquartersState?: string | null
    headquartersCountry?: string | null
    linkedinUrl?: string | null
    aiFitScore?: number | null
    researchSummary?: string | null
    currentCrmStatus?: string
    assignedToId?: string | null
    // duplicate confirmation: pass true to proceed despite a warning
    confirmDuplicate?: boolean
  }

  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 })
  }

  // Duplicate detection — hard block without confirmation flag
  const duplicate = await findDuplicateProspect({
    companyName: body.companyName,
    website: body.website,
  })
  if (duplicate && !body.confirmDuplicate) {
    return NextResponse.json(
      {
        warning: "duplicate_detected",
        message: `A similar company already exists — "${duplicate.companyName}" owned by ${duplicate.assignedToName ?? "unassigned"}, current status: ${duplicate.currentCrmStatus}. Are you sure this is a different company?`,
        existing: duplicate,
      },
      { status: 409 }
    )
  }

  const assignedToId = body.assignedToId ?? info.salesUserId
  const assignedUser = assignedToId
    ? await prisma.salesUser.findUnique({ where: { id: assignedToId }, select: { name: true } })
    : null

  const prospect = await prisma.prospect.create({
    data: {
      companyName: body.companyName.trim(),
      website: body.website ?? null,
      industry: body.industry ?? null,
      employeeCountMin: body.employeeCountMin ?? null,
      employeeCountMax: body.employeeCountMax ?? null,
      locationsCount: body.locationsCount ?? null,
      headquartersCity: body.headquartersCity ?? null,
      headquartersState: body.headquartersState ?? null,
      headquartersCountry: body.headquartersCountry ?? "US",
      linkedinUrl: body.linkedinUrl ?? null,
      aiFitScore: body.aiFitScore ?? null,
      researchSummary: body.researchSummary ?? null,
      currentCrmStatus: (body.currentCrmStatus as never) ?? "researched",
      assignedToId,
      assignedToName: assignedUser?.name ?? null,
      source: "manual",
      // Mark as confirmed duplicate for admin review
      ...(duplicate && body.confirmDuplicate ? {
        duplicateFlag: true,
        duplicateOfId: duplicate.id,
      } : {}),
    },
    select: PROSPECT_SELECT,
  })

  // Log assignment history
  await prisma.accountAssignmentHistory.create({
    data: {
      recordType: "prospect",
      recordId: prospect.id,
      previousOwnerId: null,
      newOwnerId: assignedToId,
      changedById: info.salesUserId ?? "unknown",
      changedByType: info.isSuperAdmin ? "SUPER_ADMIN" : "SALES_USER",
      reason: "Initial assignment on creation",
    },
  })

  // Notify all admin_sales users when a confirmed duplicate is created
  if (duplicate && body.confirmDuplicate) {
    const admins = await prisma.salesUser.findMany({
      where: { role: "admin_sales", isActive: true },
      select: { id: true },
    })
    if (admins.length > 0) {
      await prisma.salesAlert.createMany({
        data: admins.map(admin => ({
          recipientId: admin.id,
          type: "duplicate_prospect",
          title: "Potential duplicate account created",
          message: `A potential duplicate account was created: "${body.companyName.trim()}" may duplicate "${duplicate.companyName}" owned by ${duplicate.assignedToName ?? "unassigned"}. Please review.`,
          relatedId: prospect.id,
        })),
      })
    }
  }

  return NextResponse.json(
    { prospect, confirmedDuplicate: !!(duplicate && body.confirmDuplicate) },
    { status: 201 }
  )
}
