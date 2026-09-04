import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { isWashEssentials, calculatePrice, type PlanKey, type ModuleId } from "@/lib/pricing"
import { buildLineItems } from "@/lib/stripe-prices"
import * as Sentry from "@sentry/nextjs"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isWashEssentials(session.productLine)) {
    return NextResponse.json({ error: "Only Wash Essentials accounts can use this upgrade path." }, { status: 400 })
  }

  const body = await req.json() as {
    plan:               PlanKey
    locationCount:      number
    employeeCount?:     number
    selectedModuleIds?: ModuleId[]
    intelligenceSuite?: boolean
  }

  const { plan, locationCount } = body
  const employeeCount     = body.employeeCount     ?? 10
  const selectedModuleIds = body.selectedModuleIds ?? []
  const intelligenceSuite = plan === "professional_plus" ? true : (body.intelligenceSuite ?? false)

  // Only non-wash plans are valid upgrade targets
  const validUpgradePlans: PlanKey[] = ["essentials", "professional", "professional_plus"]
  if (!validUpgradePlans.includes(plan)) {
    return NextResponse.json({ error: "Invalid upgrade target plan." }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: {
      id:                  true,
      industry:            true,
      productLine:         true,
      stripeSubscriptionId:true,
      discountPercent:     true,
    },
  })
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 })
  if (!isWashEssentials(org.productLine)) {
    return NextResponse.json({ error: "Only Wash Essentials accounts can use this upgrade path." }, { status: 400 })
  }

  try {
    const lineItems = buildLineItems({ plan, employeeCount, locationCount, selectedModuleIds, intelligenceSuite })

    if (stripe && org.stripeSubscriptionId) {
      // Active subscription — swap items directly (no new checkout session)
      const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
      const deleteItems = subscription.items.data.map(item => ({ id: item.id, deleted: true as const }))
      const addItems    = lineItems.map(li => ({ price: li.price, quantity: li.quantity }))

      await stripe.subscriptions.update(org.stripeSubscriptionId, {
        items:              [...deleteItems, ...addItems],
        proration_behavior: "create_prorations",
      })
    }
    // If no active subscription (trialing): DB-only update; checkout will handle Stripe when they subscribe.

    const pricing = calculatePrice({
      plan,
      employeeCount,
      locationCount,
      selectedModuleIds,
      intelligenceSuite,
      discountPercent: org.discountPercent ?? undefined,
    })

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        plan,
        productLine:                "RELAY_STANDARD",
        employeeLimit:              employeeCount,
        locationLimit:              locationCount,
        intelligenceModules:        intelligenceSuite
          ? ["issue_intelligence", "sop_intelligence", "asset_intelligence", "benchmark_intelligence", "purchase_intelligence"]
          : selectedModuleIds,
        intelligenceSuiteEnabled:   intelligenceSuite,
        monthlyBasePrice:           pricing.basePrice,
        monthlyScalingCost:         pricing.employeeScaling + pricing.locationScaling,
        monthlyModulesCost:         pricing.moduleCost,
        monthlyTotalBeforeDiscount: pricing.totalBeforeDiscount,
        monthlyTotalAfterDiscount:  pricing.totalAfterDiscount,
      },
    })

    await createSession({ ...session, plan, productLine: "RELAY_STANDARD" })

    return NextResponse.json({ success: true })
  } catch (err) {
    Sentry.captureException(err, { tags: { subsystem: "upgrade_to_relay" } })
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Upgrade failed: ${msg}` }, { status: 500 })
  }
}
