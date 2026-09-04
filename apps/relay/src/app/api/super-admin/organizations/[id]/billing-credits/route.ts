import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { createCredit } from "@/lib/billing-credits-engine"
import type { CreditType, CreditAppliesTo, CreditSchedulingType, CreditDurationType } from "@/generated/prisma/client"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const credits = await prisma.billingCredit.findMany({
    where: { orgId: id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(credits)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as {
    creditType?:                CreditType
    appliesTo?:                 CreditAppliesTo
    appliesToDetail?:           string
    discountValue?:             number
    description?:               string
    internalNotes?:             string
    schedulingType?:            CreditSchedulingType
    scheduledStartDate?:        string
    scheduledStartAfterMonths?: number
    durationType?:              CreditDurationType
    durationCycles?:            number
    durationUntilDate?:         string
    reason?:                    string
  }

  if (!body.creditType || !body.appliesTo || body.discountValue === undefined ||
      !body.description || !body.schedulingType || !body.durationType) {
    return NextResponse.json({ error: "creditType, appliesTo, discountValue, description, schedulingType, durationType are required" }, { status: 400 })
  }

  try {
    const credit = await createCredit(
      id,
      {
        creditType:                body.creditType,
        appliesTo:                 body.appliesTo,
        appliesToDetail:           body.appliesToDetail,
        discountValue:             body.discountValue,
        description:               body.description,
        internalNotes:             body.internalNotes,
        schedulingType:            body.schedulingType,
        scheduledStartDate:        body.scheduledStartDate ? new Date(body.scheduledStartDate) : undefined,
        scheduledStartAfterMonths: body.scheduledStartAfterMonths,
        durationType:              body.durationType,
        durationCycles:            body.durationCycles,
        durationUntilDate:         body.durationUntilDate ? new Date(body.durationUntilDate) : undefined,
        reason:                    body.reason,
      },
      session.superAdminId,
      { superAdminId: session.superAdminId, superAdminName: session.name, orgName: org.name },
    )
    // Fetch fresh after potential activation
    const fresh = await prisma.billingCredit.findUnique({ where: { id: credit.id } })
    return NextResponse.json(fresh)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create credit" }, { status: 500 })
  }
}
