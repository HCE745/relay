import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const orgId  = searchParams.get("orgId")

  const calls = await prisma.demoCall.findMany({
    where: {
      ...(status ? { callStatus: status }             : {}),
      ...(orgId  ? { organizationId: orgId }          : {}),
    },
    orderBy: { scheduledAt: "desc" },
    include: { organization: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ calls })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as {
    contactName:    string
    contactEmail:   string
    contactPhone?:  string
    companyName:    string
    industry?:      string
    employeeCount?: number
    locationCount?: number
    leadSource:     string
    scheduledAt?:   string
    callStatus:     string
    callNotes?:     string
    painPoints?:    string
    followUpDate?:  string
    outcome?:       string
    organizationId?: string
  }

  const call = await prisma.demoCall.create({
    data: {
      contactName:    body.contactName,
      contactEmail:   body.contactEmail,
      contactPhone:   body.contactPhone ?? null,
      companyName:    body.companyName,
      industry:       body.industry ?? null,
      employeeCount:  body.employeeCount ?? null,
      locationCount:  body.locationCount ?? null,
      leadSource:     body.leadSource ?? "Other",
      scheduledAt:    body.scheduledAt ? new Date(body.scheduledAt) : null,
      callStatus:     body.callStatus ?? "Scheduled",
      callNotes:      body.callNotes ?? null,
      painPoints:     body.painPoints ?? null,
      followUpDate:   body.followUpDate ? new Date(body.followUpDate) : null,
      outcome:        body.outcome ?? null,
      organizationId: body.organizationId ?? null,
      createdBySAName: session.name,
    },
  })

  // If linked org, create CRM activity
  if (body.organizationId) {
    await prisma.crmActivity.create({
      data: {
        organizationId:  body.organizationId,
        eventType:       "demo_scheduled",
        description:     `Demo call scheduled with ${body.contactName} (${body.contactEmail})`,
        createdBySAName: session.name,
      },
    })
    // Auto-update lifecycle to Demo Scheduled if still at Lead
    const org = await prisma.organization.findUnique({
      where: { id: body.organizationId }, select: { lifecycleStatus: true },
    })
    if (org && ["Lead"].includes(org.lifecycleStatus)) {
      await prisma.organization.update({
        where: { id: body.organizationId },
        data:  { lifecycleStatus: "Demo Scheduled" },
      })
    }
  }

  return NextResponse.json({ call })
}
