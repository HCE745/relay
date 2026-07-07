import { NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { cleanupExpiredDemos } from "@/lib/demo-seed"
import { randomBytes } from "crypto"
import bcrypt from "bcryptjs"

// POST /api/super-admin/test-session
// Creates a temp org with onboardingCompleted=false so the SA can test the onboarding wizard.
// The org is flagged as a demo so it gets cleaned up automatically.
export async function POST() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await cleanupExpiredDemos()

  const token = randomBytes(6).toString("hex")
  const name = `Test Org ${token}`
  const email = `test-${token}@relay-test.internal`

  const org = await prisma.organization.create({
    data: {
      name,
      slug: `test-${token}`,
      isDemo: true,
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      aiSuggestionsAvailable: true,
    },
  })

  const passwordHash = await bcrypt.hash("TestPassword1!", 10)

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Test Admin",
      email,
      password: passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  })

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: "ADMIN",
    organizationId: org.id,
    onboardingCompleted: false,
    subscriptionStatus: "trialing",
    isDemo: true,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

