"use server"

import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "./prisma"
import { createSession, deleteSession } from "./session"
import { checkLimitAction, limiters } from "./ratelimit"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "./legal-versions"

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
    include: { organization: { select: { onboardingCompletedAt: true, trialEndsAt: true, subscriptionStatus: true, plan: true } } },
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
  })

  redirect("/dashboard")
}

export async function register(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const orgName = formData.get("orgName") as string

  if (!name || !email || !password || !orgName) {
    return { error: "All fields are required" }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: "Email already registered" }

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Date.now().toString(36)

  const hashedPassword = await bcrypt.hash(password, 12)
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const org = await prisma.organization.create({
    data: { name: orgName, slug, trialEndsAt, subscriptionStatus: "trialing", plan: "essentials" },
  })

  const headersList = await headers()
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
    headersList.get("x-real-ip") ||
    null

  const user = await prisma.user.create({
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

  redirect("/onboarding")
}

export async function logout() {
  await deleteSession()
  redirect("/login")
}
