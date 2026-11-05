export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

function salesFilter(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return null
  if (session.superAdmin || session.salesUserRole === "admin_sales") return {}
  return { assignedToId: session.salesUserId ?? "" }
}

// GET /api/sales/companies?q=&status=&sort=&page=
// Returns Prospect records as "companies" with contact count and latest activity
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const filter = salesFilter(session)
  if (!filter) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
