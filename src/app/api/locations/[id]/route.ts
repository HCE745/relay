import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { syncWashEssentialsLocationBilling } from "@/lib/wash-billing"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  const loc = await prisma.location.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.location.update({
    where: { id },
    data: {
      name:            body.name     ?? loc.name,
      address:         body.address  ?? loc.address,
      city:            body.city     ?? loc.city,
      state:           body.state    ?? loc.state,
      country:         body.country  ?? loc.country,
      parentId:        body.parentId || null,
      safetyContactId: body.safetyContactId || null,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  const loc = await prisma.location.findFirst({ where: { id, organizationId: session.organizationId } })
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // ── Wash Essentials: Stripe-first location removal ────────────────────────
  // Decrease the additional-location billing quantity BEFORE deleting from DB.
  // If Stripe fails the user sees an error and the location remains (consistent).
  // If the DB delete later fails we compensate Stripe back (location remains consistent).
  let stripeSubscriptionId: string | null = null
  let didUpdateStripe = false

  if (isWashEssentials(session.productLine)) {
    const org = await prisma.organization.findUnique({
      where:  { id: session.organizationId },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    })

    if (org?.stripeSubscriptionId && org.subscriptionStatus === "active") {
      stripeSubscriptionId = org.stripeSubscriptionId
      const currentCount    = await prisma.location.count({ where: { organizationId: session.organizationId } })
      // After removal: total = currentCount - 1; additional = max(0, (currentCount - 1) - 1)
      const newAdditional = Math.max(0, currentCount - 2)

      const stripeErr = await syncWashEssentialsLocationBilling(stripeSubscriptionId, newAdditional)
      if (stripeErr) {
        return NextResponse.json(
          { error: `Could not update billing: ${stripeErr} Please try again.` },
          { status: 503 },
        )
      }
      didUpdateStripe = true
    }
  }

  // Delete from DB
  try {
    await prisma.location.delete({ where: { id } })

    // Archive the channel for this location
    await prisma.conversation.updateMany({
      where: { channelRefType: "location", channelRefId: id },
      data:  { isArchived: true },
    })
  } catch (err) {
    // Compensate: restore the previous Stripe quantity
    if (didUpdateStripe && stripeSubscriptionId) {
      const restoredCount    = await prisma.location.count({ where: { organizationId: session.organizationId } })
      const restoredAdditional = Math.max(0, restoredCount - 1)
      await syncWashEssentialsLocationBilling(stripeSubscriptionId, restoredAdditional).catch(console.error)
    }
    throw err
  }

  return NextResponse.json({ success: true })
}
