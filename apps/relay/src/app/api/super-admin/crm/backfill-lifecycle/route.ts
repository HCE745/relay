import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = new Date()

  // Only update orgs still on the default "Lead" that have never been manually set
  // Dry-run if ?dry=1
  const { searchParams } = new URL(req.url)
  const dry = searchParams.get("dry") === "1"

  // Fetch all non-demo orgs that are still on "Lead"
  const leads = await prisma.organization.findMany({
    where:  { lifecycleStatus: "Lead", isDemo: false },
    select: { id: true, subscriptionStatus: true, trialEndsAt: true },
  })

  const buckets = {
    converted:    [] as string[],
    trialActive:  [] as string[],
    trialExpired: [] as string[],
    cancelled:    [] as string[],
    lead:         [] as string[],
  }

  for (const org of leads) {
    if (org.subscriptionStatus === "active" || org.subscriptionStatus === "past_due") {
      buckets.converted.push(org.id)
    } else if (org.subscriptionStatus === "trialing" && org.trialEndsAt && org.trialEndsAt > now) {
      buckets.trialActive.push(org.id)
    } else if (org.subscriptionStatus === "trialing" && (!org.trialEndsAt || org.trialEndsAt <= now)) {
      buckets.trialExpired.push(org.id)
    } else if (org.subscriptionStatus === "canceled" || org.subscriptionStatus === "cancelled") {
      buckets.cancelled.push(org.id)
    } else {
      buckets.lead.push(org.id)
    }
  }

  if (!dry) {
    await Promise.all([
      buckets.converted.length && prisma.organization.updateMany({
        where: { id: { in: buckets.converted } },
        data:  { lifecycleStatus: "Converted" },
      }),
      buckets.trialActive.length && prisma.organization.updateMany({
        where: { id: { in: buckets.trialActive } },
        data:  { lifecycleStatus: "Trial Active" },
      }),
      buckets.trialExpired.length && prisma.organization.updateMany({
        where: { id: { in: buckets.trialExpired } },
        data:  { lifecycleStatus: "Trial Expired" },
      }),
      buckets.cancelled.length && prisma.organization.updateMany({
        where: { id: { in: buckets.cancelled } },
        data:  { lifecycleStatus: "Cancelled" },
      }),
    ])
  }

  return NextResponse.json({
    dry,
    total:         leads.length,
    converted:     buckets.converted.length,
    trialActive:   buckets.trialActive.length,
    trialExpired:  buckets.trialExpired.length,
    cancelled:     buckets.cancelled.length,
    remainingLead: buckets.lead.length,
  })
}
