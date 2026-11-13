export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

const excludeDemo = { NOT: { assignedTo: { isDemo: true } } }

// GET /api/sales/companies?q=&status=&sort=&page=
// Returns Prospect records as "companies" with contact count and latest activity
export async function GET(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Role is re-validated from DB on every request via getSalesSession(), so stale
  // session JWTs cannot bypass ownership filters.
  const filter = info.isManager || info.isSuperAdmin
    ? excludeDemo
    : { assignedToId: info.salesUserId }

  const { searchParams } = new URL(req.url)
  const q       = searchParams.get("q")?.trim() ?? ""
  const status  = searchParams.get("status") ?? ""
  const sort    = searchParams.get("sort") ?? "updatedAt_desc"
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit   = 50

  const where: Record<string, unknown> = { ...filter }
  if (q) {
    where.OR = [
      { companyName:        { contains: q, mode: "insensitive" } },
      { industry:           { contains: q, mode: "insensitive" } },
      { headquartersCity:   { contains: q, mode: "insensitive" } },
      { headquartersState:  { contains: q, mode: "insensitive" } },
      { contacts: { some: { email: { contains: q, mode: "insensitive" } } } },
    ]
  }
  if (status) where.currentCrmStatus = status

  const orderByMap: Record<string, object> = {
    updatedAt_desc:   { updatedAt: "desc" },
    updatedAt_asc:    { updatedAt: "asc" },
    companyName_asc:  { companyName: "asc" },
    companyName_desc: { companyName: "desc" },
    aiFitScore_desc:  { aiFitScore: "desc" },
    createdAt_desc:   { createdAt: "desc" },
  }
  const orderBy = orderByMap[sort] ?? { updatedAt: "desc" }

  const [companies, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy,
      skip:  (page - 1) * limit,
      take:  limit,
      select: {
        id:                true,
        companyName:       true,
        website:           true,
        industry:          true,
        phone:             true,
        headquartersCity:  true,
        headquartersState: true,
        currentCrmStatus:  true,
        aiFitScore:        true,
        assignedToId:      true,
        assignedToName:    true,
        duplicateFlag:     true,
        tags:              true,
        updatedAt:         true,
        createdAt:         true,
        assignedTo:        { select: { id: true, name: true } },
        contacts:          { select: { id: true, name: true, title: true, email: true, isPrimaryContact: true, isDecisionMaker: true }, orderBy: { isPrimaryContact: "desc" } },
        opportunities:     { select: { id: true, stage: true, value: true, wonAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count:            { select: { contacts: true, opportunities: true, salesActivities: true } },
      },
    }),
    prisma.prospect.count({ where }),
  ])

  return NextResponse.json({ companies, total, page, pages: Math.ceil(total / limit) })
}
