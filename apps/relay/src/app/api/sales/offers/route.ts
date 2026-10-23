import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
const MAX_REP_DISCOUNT_PERCENT = 20

function generateToken(): string {
  return randomBytes(9).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

export async function POST(req: NextRequest) {
  const session = await getSalesSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    opportunityId?: string
    offerType: string
    discountPercent?: number
    flatMonthlyPrice?: number
    freeMonths?: number
    durationMonths?: number
    targetPlan: string
    maxRedemptions?: number
    expiresAt?: string
    notes?: string
  }

  const { offerType, targetPlan } = body

  if (!["PERCENT_DISCOUNT", "FLAT_PRICE", "FREE_MONTHS"].includes(offerType)) {
    return NextResponse.json({ error: "Invalid offerType" }, { status: 400 })
  }
  if (!["essentials", "professional", "professional_plus", "wash_essentials"].includes(targetPlan)) {
    return NextResponse.json({ error: "Invalid targetPlan" }, { status: 400 })
  }

  const isAdmin = session.isManager

  // Reps can only create PERCENT_DISCOUNT offers capped at MAX_REP_DISCOUNT_PERCENT
  if (!isAdmin) {
    if (offerType !== "PERCENT_DISCOUNT") {
      return NextResponse.json({ error: "Sales reps can only create percentage discount offers" }, { status: 403 })
    }
    if ((body.discountPercent ?? 0) > MAX_REP_DISCOUNT_PERCENT) {
      return NextResponse.json({ error: `Discount cannot exceed ${MAX_REP_DISCOUNT_PERCENT}%` }, { status: 400 })
    }
  }

  // Validate type-specific fields
  if (offerType === "PERCENT_DISCOUNT" && !body.discountPercent) {
    return NextResponse.json({ error: "discountPercent is required" }, { status: 400 })
  }
  if (offerType === "FLAT_PRICE" && !body.flatMonthlyPrice) {
    return NextResponse.json({ error: "flatMonthlyPrice is required" }, { status: 400 })
  }
  if (offerType === "FREE_MONTHS" && !body.freeMonths) {
    return NextResponse.json({ error: "freeMonths is required" }, { status: 400 })
  }

  // Verify opportunity exists and belongs to this rep (or is accessible to admin)
  if (body.opportunityId) {
    const opp = await prisma.crmOpportunity.findUnique({
      where: { id: body.opportunityId },
      select: { id: true, assignedToId: true, stage: true },
    })
    if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    if (!isAdmin && opp.assignedToId !== session.salesUserId) {
      return NextResponse.json({ error: "Not your opportunity" }, { status: 403 })
    }
  }

  const token = generateToken()

  const offer = await prisma.salesOffer.create({
    data: {
      token,
      createdBySalesUserId: session.salesUserId,
      opportunityId:        body.opportunityId ?? null,
      offerType,
      discountPercent:      body.discountPercent ?? null,
      flatMonthlyPrice:     body.flatMonthlyPrice ?? null,
      freeMonths:           body.freeMonths ?? null,
      durationMonths:       body.durationMonths ?? null,
      targetPlan,
      maxRedemptions:       body.maxRedemptions ?? 1,
      expiresAt:            body.expiresAt ? new Date(body.expiresAt) : null,
      notes:                body.notes ?? null,
    },
  })

  const offerUrl = `${APP_URL}/register?offer=${token}`

  return NextResponse.json({ offer, offerUrl })
}

export async function GET() {
  const session = await getSalesSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const where = session.isManager
    ? {}
    : { createdBySalesUserId: session.salesUserId }

  const offers = await prisma.salesOffer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBySalesUser: { select: { name: true } },
      opportunity:        { select: { id: true, title: true } },
      redeemedByOrg:      { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(offers.map(o => ({
    ...o,
    offerUrl: `${APP_URL}/register?offer=${o.token}`,
  })))
}
