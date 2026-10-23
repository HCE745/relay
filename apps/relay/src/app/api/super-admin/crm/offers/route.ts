import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

export const dynamic = "force-dynamic"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

function generateToken(): string {
  return randomBytes(9).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  if (offerType === "PERCENT_DISCOUNT" && !body.discountPercent) {
    return NextResponse.json({ error: "discountPercent is required" }, { status: 400 })
  }
  if (offerType === "FLAT_PRICE" && !body.flatMonthlyPrice) {
    return NextResponse.json({ error: "flatMonthlyPrice is required" }, { status: 400 })
  }
  if (offerType === "FREE_MONTHS" && !body.freeMonths) {
    return NextResponse.json({ error: "freeMonths is required" }, { status: 400 })
  }

  const token = generateToken()
  const offer = await prisma.salesOffer.create({
    data: {
      token,
      createdBySAId:    session.superAdminId ?? null,
      opportunityId:    body.opportunityId ?? null,
      offerType,
      discountPercent:  body.discountPercent ?? null,
      flatMonthlyPrice: body.flatMonthlyPrice ?? null,
      freeMonths:       body.freeMonths ?? null,
      durationMonths:   body.durationMonths ?? null,
      targetPlan,
      maxRedemptions:   body.maxRedemptions ?? 1,
      expiresAt:        body.expiresAt ? new Date(body.expiresAt) : null,
      notes:            body.notes ?? null,
    },
  })

  return NextResponse.json({ offer, offerUrl: `${APP_URL}/register?offer=${token}` })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const offers = await prisma.salesOffer.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      createdBySalesUser: { select: { name: true, email: true } },
      createdBySA:        { select: { name: true } },
      opportunity:        { select: { id: true, title: true } },
      redeemedByOrg:      { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(offers.map(o => ({
    ...o,
    discountPercent:  o.discountPercent  ? Number(o.discountPercent)  : null,
    flatMonthlyPrice: o.flatMonthlyPrice ? Number(o.flatMonthlyPrice) : null,
    offerUrl:         `${APP_URL}/register?offer=${o.token}`,
  })))
}
