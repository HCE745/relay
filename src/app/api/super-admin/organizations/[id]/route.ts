import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as {
    name?: string
    plan?: string
    subscriptionStatus?: string
    trialEndsAt?: string | null
    stripeSubscriptionId?: string | null
    employeeLimit?: number | null
    locationLimit?: number | null
    suspend?: boolean
    resetOnboarding?: boolean
    aiSuggestionsAvailable?: boolean
    // Pricing fields
    billingFrequency?: string
    currentPrice?: number | null
    priceLockedUntil?: string | null
    intelligenceModules?: string[]
    intelligenceSuiteEnabled?: boolean
    // Discount
    discountPercent?: number | null
    discountExpiresAt?: string | null
    discountLabel?: string | null
    _pricingUpdate?: boolean // flag to use UPDATE_PRICING action
  }

  const before: Record<string, unknown> = {}
  const after:  Record<string, unknown> = {}
  const data:   Record<string, unknown> = {}

  function track<K extends string>(key: K, oldVal: unknown, newVal: unknown) {
    before[key] = oldVal
    after[key]  = newVal
    data[key]   = newVal
  }

  if (body.name !== undefined && body.name !== org.name) {
    track("name", org.name, body.name)
  }
  if (body.plan !== undefined && body.plan !== org.plan) {
    track("plan", org.plan, body.plan)
  }
  if (body.subscriptionStatus !== undefined && body.subscriptionStatus !== org.subscriptionStatus) {
    track("subscriptionStatus", org.subscriptionStatus, body.subscriptionStatus)
  }
  if ("trialEndsAt" in body) {
    const newDate = body.trialEndsAt ? new Date(body.trialEndsAt) : null
    track("trialEndsAt", org.trialEndsAt?.toISOString() ?? null, newDate?.toISOString() ?? null)
  }
  if ("stripeSubscriptionId" in body) {
    track("stripeSubscriptionId", org.stripeSubscriptionId ?? null, body.stripeSubscriptionId ?? null)
  }
  if ("employeeLimit" in body) {
    track("employeeLimit", org.employeeLimit ?? null, body.employeeLimit ?? null)
  }
  if ("locationLimit" in body) {
    track("locationLimit", org.locationLimit ?? null, body.locationLimit ?? null)
  }
  if (body.aiSuggestionsAvailable !== undefined && body.aiSuggestionsAvailable !== org.aiSuggestionsAvailable) {
    track("aiSuggestionsAvailable", org.aiSuggestionsAvailable, body.aiSuggestionsAvailable)
  }

  // Pricing fields
  if (body.billingFrequency !== undefined && body.billingFrequency !== org.billingFrequency) {
    track("billingFrequency", org.billingFrequency, body.billingFrequency)
  }
  if ("currentPrice" in body) {
    const newPrice = body.currentPrice ?? null
    if (newPrice !== (org.currentPrice ?? null)) {
      track("currentPrice", org.currentPrice ?? null, newPrice)
    }
  }
  if ("priceLockedUntil" in body) {
    const newDate = body.priceLockedUntil ? new Date(body.priceLockedUntil) : null
    track("priceLockedUntil", org.priceLockedUntil?.toISOString() ?? null, newDate?.toISOString() ?? null)
  }
  if (body.intelligenceModules !== undefined) {
    const current = [...org.intelligenceModules].sort().join(",")
    const next = [...body.intelligenceModules].sort().join(",")
    if (current !== next) {
      track("intelligenceModules", org.intelligenceModules, body.intelligenceModules)
    }
  }
  if (body.intelligenceSuiteEnabled !== undefined && body.intelligenceSuiteEnabled !== org.intelligenceSuiteEnabled) {
    track("intelligenceSuiteEnabled", org.intelligenceSuiteEnabled, body.intelligenceSuiteEnabled)
  }

  // Discount fields
  if ("discountPercent" in body) {
    const newVal = body.discountPercent ?? null
    if (newVal !== (org.discountPercent ?? null)) {
      track("discountPercent", org.discountPercent ?? null, newVal)
    }
  }
  if ("discountExpiresAt" in body) {
    const newDate = body.discountExpiresAt ? new Date(body.discountExpiresAt) : null
    track("discountExpiresAt", org.discountExpiresAt?.toISOString() ?? null, newDate?.toISOString() ?? null)
  }
  if ("discountLabel" in body) {
    const newLabel = body.discountLabel ?? null
    if (newLabel !== (org.discountLabel ?? null)) {
      track("discountLabel", org.discountLabel ?? null, newLabel)
    }
  }

  let action: "UPDATE_ORG" | "SUSPEND_ORG" | "REACTIVATE_ORG" | "RESET_ONBOARDING" | "UPDATE_PRICING" = "UPDATE_ORG"

  if (body.suspend === true) {
    action = "SUSPEND_ORG"
    track("suspendedAt", org.suspendedAt?.toISOString() ?? null, new Date().toISOString())
    track("subscriptionStatus", org.subscriptionStatus, "suspended")
  } else if (body.suspend === false) {
    action = "REACTIVATE_ORG"
    track("suspendedAt", org.suspendedAt?.toISOString() ?? null, null)
    if (org.subscriptionStatus === "suspended") {
      track("subscriptionStatus", "suspended", "trialing")
    }
  }

  if (body.resetOnboarding === true) {
    action = "RESET_ONBOARDING"
    track("onboardingCompletedAt", org.onboardingCompletedAt?.toISOString() ?? null, null)
  }

  if (body._pricingUpdate) {
    action = "UPDATE_PRICING"
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 })
  }

  // Remove meta flag before writing to DB
  delete data._pricingUpdate

  await prisma.organization.update({ where: { id }, data })

  await logSAAction({
    superAdminId:   session.superAdminId,
    superAdminName: session.name,
    action,
    orgId:      org.id,
    orgName:    org.name,
    targetType: "organization",
    targetId:   org.id,
    targetName: org.name,
    before,
    after,
  })

  return NextResponse.json({ success: true })
}
