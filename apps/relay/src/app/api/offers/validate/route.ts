import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

  const offer = await prisma.salesOffer.findUnique({
    where: { token },
    select: {
      id:               true,
      offerType:        true,
      discountPercent:  true,
      flatMonthlyPrice: true,
      freeMonths:       true,
      durationMonths:   true,
      targetPlan:       true,
      maxRedemptions:   true,
      redemptionCount:  true,
      expiresAt:        true,
      redeemedAt:       true,
    },
  })

  if (!offer) return NextResponse.json({ error: "Invalid offer" }, { status: 404 })

  const now = new Date()
  if (offer.expiresAt && offer.expiresAt < now) {
    return NextResponse.json({ error: "Offer has expired", expired: true }, { status: 410 })
  }
  if (offer.redemptionCount >= offer.maxRedemptions) {
    return NextResponse.json({ error: "Offer has already been redeemed", exhausted: true }, { status: 410 })
  }
  if (offer.redeemedAt) {
    return NextResponse.json({ error: "Offer has already been redeemed", exhausted: true }, { status: 410 })
  }

  return NextResponse.json(offer)
}
