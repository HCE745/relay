import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials, WASH_ESSENTIALS_MAX_LOCATIONS } from "@/lib/pricing"
import { syncWashEssentialsLocationBilling } from "@/lib/wash-billing"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const locations = await prisma.location.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assets: true, issues: true, users: true } },
      parent: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(locations)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const { name, address, city, state, country, parentId, safetyContactId } = body
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })

  // ── Wash Essentials: location cap + real-time billing sync ────────────────
  if (isWashEssentials(session.productLine)) {
    const currentCount = await prisma.location.count({
      where: { organizationId: session.organizationId },
    })

    if (currentCount >= WASH_ESSENTIALS_MAX_LOCATIONS) {
      return NextResponse.json(
        {
          error:           "You have reached the Wash Essentials location limit (7 locations). Full Relay Wash Edition is designed for larger multi-location operations.",
          upgradeRequired: true,
        },
        { status: 403 },
      )
    }

    // Sync Stripe BEFORE writing to DB ("Stripe first") so billing and
    // operational state cannot silently diverge on a Stripe failure.
    const org = await prisma.organization.findUnique({
      where:  { id: session.organizationId },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    })

    if (org?.stripeSubscriptionId && org.subscriptionStatus === "active") {
      // After adding this location, additional count = currentCount (total becomes currentCount+1,
      // minus 1 included = currentCount additional).
      const newAdditionalCount = currentCount
      const stripeErr = await syncWashEssentialsLocationBilling(
        org.stripeSubscriptionId,
        newAdditionalCount,
      )
      if (stripeErr) {
        return NextResponse.json(
          { error: `Could not update billing: ${stripeErr} Please try again.` },
          { status: 503 },
        )
      }
    }
  }

  // Create location in DB.
  // If Stripe succeeded but this write fails (rare), attempt to roll back Stripe.
  let location
  try {
    location = await prisma.location.create({
      data: {
        name,
        address:         address || null,
        city:            city || null,
        state:           state || null,
        country:         country || null,
        parentId:        parentId || null,
        safetyContactId: safetyContactId || null,
        organizationId:  session.organizationId,
      },
    })
  } catch (err) {
    // Compensate: restore the previous Stripe quantity so billing stays correct.
    if (isWashEssentials(session.productLine)) {
      const org = await prisma.organization.findUnique({
        where:  { id: session.organizationId },
        select: { stripeSubscriptionId: true, subscriptionStatus: true },
      })
      if (org?.stripeSubscriptionId && org.subscriptionStatus === "active") {
        const prevCount = await prisma.location.count({ where: { organizationId: session.organizationId } })
        const prevAdditional = Math.max(0, prevCount - 1)
        await syncWashEssentialsLocationBilling(org.stripeSubscriptionId, prevAdditional).catch(console.error)
      }
    }
    throw err
  }

  // Auto-create a channel for this location
  createLocationChannel(session.organizationId, location.id, location.name).catch(console.error)

  return NextResponse.json(location, { status: 201 })
}

async function createLocationChannel(orgId: string, locationId: string, locationName: string) {
  const existing = await prisma.conversation.findFirst({
    where: { orgId, channelRefType: "location", channelRefId: locationId },
  })
  if (existing) return

  const members = await prisma.user.findMany({
    where: { organizationId: orgId, locationId },
    select: { id: true },
  })

  await prisma.conversation.create({
    data: {
      orgId,
      type:           "channel",
      name:           locationName,
      channelRefType: "location",
      channelRefId:   locationId,
      members:        { create: members.map(u => ({ userId: u.id })) },
    },
  })
}
