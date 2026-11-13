export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

// GET /api/sales/companies/[id] — full company detail with all relations
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const company = await prisma.prospect.findUnique({
    where: { id },
    include: {
      assignedTo:   { select: { id: true, name: true, email: true } },
      contacts:     { orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }] },
      notes:        { orderBy: { createdAt: "desc" }, take: 50 },
      opportunities: {
        include: {
          assignedTo: { select: { id: true, name: true } },
          contact:    { select: { id: true, name: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      demoCalls: {
        include: {
          assignedTo: { select: { id: true, name: true } },
          organization: {
            select: {
              id: true,
              name: true,
              subscriptionStatus: true,
              stripeSubscriptionId: true,
              plan: true,
              productLine: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      salesActivities: {
        include: { salesUser: { select: { id: true, name: true } }, contact: { select: { id: true, name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 100,
      },
      tasks: {
        include: { assignedTo: { select: { id: true, name: true } }, contact: { select: { id: true, name: true } } },
        where: { completedAt: null },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      },
      emails: {
        select: {
          id: true, direction: true, subject: true, bodyText: true,
          sentAt: true, fromAddress: true, toAddress: true,
          isRead: true, openedAt: true, openCount: true, sentiment: true,
          contact: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 100,
      },
    },
  })

  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Reps can only view their own assigned prospects
  if (!info.isManager && !info.isSuperAdmin && company.assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ company })
}

// PATCH /api/sales/companies/[id] — update company profile fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Reps can only update their own assigned prospects
  if (!info.isManager && !info.isSuperAdmin) {
    const existing = await prisma.prospect.findUnique({ where: { id }, select: { assignedToId: true } })
    if (!existing || existing.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  }
  const body = await req.json() as {
    companyName?:       string
    website?:           string
    industry?:          string
    phone?:             string
    description?:       string
    tags?:              string[]
    headquartersCity?:  string
    headquartersState?: string
    employeeCountMin?:  number
    employeeCountMax?:  number
    currentCrmStatus?:  string
    assignedToId?:      string
    productInterest?:   string
    linkedinUrl?:       string
  }

  const updated = await prisma.prospect.update({
    where: { id },
    data:  {
      ...(body.companyName       !== undefined && { companyName:       body.companyName }),
      ...(body.website           !== undefined && { website:           body.website }),
      ...(body.industry          !== undefined && { industry:          body.industry }),
      ...(body.phone             !== undefined && { phone:             body.phone }),
      ...(body.description       !== undefined && { description:       body.description }),
      ...(body.tags              !== undefined && { tags:              body.tags }),
      ...(body.headquartersCity  !== undefined && { headquartersCity:  body.headquartersCity }),
      ...(body.headquartersState !== undefined && { headquartersState: body.headquartersState }),
      ...(body.employeeCountMin  !== undefined && { employeeCountMin:  body.employeeCountMin }),
      ...(body.employeeCountMax  !== undefined && { employeeCountMax:  body.employeeCountMax }),
      ...(body.currentCrmStatus  !== undefined && { currentCrmStatus:  body.currentCrmStatus as never }),
      ...(body.assignedToId      !== undefined && { assignedToId:      body.assignedToId }),
      ...(body.productInterest   !== undefined && { productInterest:   body.productInterest }),
      ...(body.linkedinUrl       !== undefined && { linkedinUrl:       body.linkedinUrl }),
    },
  })

  return NextResponse.json({ company: updated })
}
