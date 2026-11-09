"use server"

import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { prisma } from "./prisma"
import { createSession, deleteSession } from "./session"
import { checkLimitAction, limiters } from "./ratelimit"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "./legal-versions"
import { syncRegistrationToCrm } from "./registration-crm-sync"

export async function login(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const headersList = await headers()
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
    headersList.get("x-real-ip") ||
    "127.0.0.1"

  const rateLimitError = await checkLimitAction(
    limiters.login,
    `login:${ip}`,
    "Too many login attempts. Please try again in 10 minutes.",
  )
  if (rateLimitError) return { error: rateLimitError }

  if (!email || !password) return { error: "Email and password are required" }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: { select: { onboardingCompletedAt: true, trialEndsAt: true, subscriptionStatus: true, plan: true, productLine: true } } },
  })
  if (!user || !user.isActive) return { error: "Invalid credentials" }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return { error: "Invalid credentials" }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    onboardingCompleted: !!user.organization.onboardingCompletedAt,
    trialEndsAt: user.organization.trialEndsAt?.toISOString(),
    subscriptionStatus: user.organization.subscriptionStatus,
    plan: user.organization.plan,
    productLine: user.organization.productLine,
  })

  redirect("/dashboard")
}

export async function register(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const orgName = formData.get("orgName") as string
  const offerToken = (formData.get("offerToken") as string | null) || null

  if (!name || !email || !password || !orgName) {
    return { error: "All fields are required" }
  }

  // Check for existing user before attempting any writes
  let existing: { id: string } | null = null
  try {
    existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  } catch {
    return { error: "Unable to reach the database. Please try again." }
  }
  if (existing) return { error: "Email already registered" }

  // Validate offer token if provided
  let validOffer: { id: string; maxRedemptions: number; redemptionCount: number; expiresAt: Date | null; redeemedAt: Date | null } | null = null
  if (offerToken) {
    try {
      validOffer = await prisma.salesOffer.findUnique({
        where: { token: offerToken },
        select: { id: true, maxRedemptions: true, redemptionCount: true, expiresAt: true, redeemedAt: true },
      })
      // Silently ignore invalid/exhausted offers — don't block registration
      if (
        !validOffer ||
        validOffer.redeemedAt ||
        validOffer.redemptionCount >= validOffer.maxRedemptions ||
        (validOffer.expiresAt && validOffer.expiresAt < new Date())
      ) {
        validOffer = null
      }
    } catch {
      validOffer = null // offer lookup failure is non-fatal
    }
  }

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Date.now().toString(36)

  const hashedPassword = await bcrypt.hash(password, 12)
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  let org: { id: string; name: string }
  let user: { id: string; email: string; name: string; role: string; organizationId: string }

  try {
    org = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        trialEndsAt,
        subscriptionStatus: "trialing",
        plan: "essentials",
        ...(validOffer ? { pendingOfferToken: offerToken } : {}),
      },
    })

    const headersList = await headers()
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
      headersList.get("x-real-ip") ||
      null

    user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: "ADMIN", organizationId: org.id },
    })

    await prisma.legalAcceptance.create({
      data: {
        userId:                  user.id,
        organizationId:          org.id,
        termsVersion:            CURRENT_TERMS_VERSION,
        privacyVersion:          CURRENT_PRIVACY_VERSION,
        ipAddress:               ip,
        aiDisclaimerAcknowledged: true,
      },
    })
  } catch (err) {
    console.error("[register] DB error", err)
    return { error: "Registration failed. Please try again." }
  }

  try {
    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      onboardingCompleted: false,
      trialEndsAt: trialEndsAt.toISOString(),
      subscriptionStatus: "trialing",
      plan: "essentials",
    })
  } catch (err) {
    console.error("[register] Session error", err)
    return { error: "Account created but session failed. Please sign in." }
  }

  // CRM sync runs AFTER the redirect response is sent — it must not block registration.
  // `after()` schedules work past the response in both server actions and route handlers.
  after(async () => {
    try {
      await syncRegistrationToCrm({
        orgId:      org.id,
        orgName:    org.name,
        adminEmail: user.email,
        adminName:  user.name,
        source:     "website_self_service",
      })
    } catch (err) {
      console.error("[CRM sync] Failed for org", org.id, err)
    }
  })

  redirect("/onboarding")
}

export async function logout() {
  await deleteSession()
  redirect("/login")
}
