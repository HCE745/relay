import { NextRequest, NextResponse, after } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import { sendEmail, welcomeEmail } from "@/lib/email"
import { checkLimit, getIP, limiters } from "@/lib/ratelimit"
import { generateUniqueReferralCode, buildReferralLink, getActiveReferralProgram } from "@/lib/billing-credits-engine"
import { logActivationEvent } from "@/lib/analytics"
import { syncRegistrationToCrm } from "@/lib/registration-crm-sync"
import { verifyTestRegToken, TEST_REG_COOKIE } from "@/lib/test-registration-token"

export async function POST(request: NextRequest) {
  const blocked = await checkLimit(
    limiters.register,
    `register:${getIP(request)}`,
    "Too many registration attempts. Please try again in an hour.",
  )
  if (blocked) return blocked

  try {
    const body = await request.json()
    const { name, email, password, orgName, ref, source } = body as {
      name?: string; email?: string; password?: string; orgName?: string
      ref?: string; source?: string
    }

    if (!name || !email || !password || !orgName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // Server-side detection of authorized test registrations via HMAC-signed HttpOnly cookie.
    // The SA generates this token from /api/super-admin/crm/test-mode/registration-token.
    // A plain query param or client-side flag would be trivially forged; this is not.
    const testToken = request.cookies.get(TEST_REG_COOKIE)?.value
    const isTestRegistration = verifyTestRegToken(testToken)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + "-" + Date.now().toString(36)

    const hashedPassword = await bcrypt.hash(password, 12)

    // Generate unique referral code for new org
    const referralCode = await generateUniqueReferralCode()
    const referralLink = buildReferralLink(referralCode)

    // Look up referrer + active program in parallel if ref= param provided
    let referrerOrg: { id: string } | null = null
    let activeProgram: Awaited<ReturnType<typeof getActiveReferralProgram>> = null
    if (ref) {
      const [org, prog] = await Promise.all([
        prisma.organization.findUnique({
          where: { referralCode: ref.toUpperCase() },
          select: { id: true },
        }),
        getActiveReferralProgram(),
      ])
      referrerOrg   = org
      activeProgram = prog
    }

    const [org, user] = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          referralCode,
          referralLink,
          // Test registrations are isolated: they never enter live round-robin,
          // customer reporting, or real sales follow-ups.
          ...(isTestRegistration ? { isDemo: true } : {}),
        },
      })
      const newUser = await tx.user.create({
        data: { name, email, password: hashedPassword, role: "ADMIN", organizationId: newOrg.id },
      })
      return [newOrg, newUser] as const
    })

    // Create referral record if came through a valid referral link
    if (referrerOrg) {
      await prisma.referral.create({
        data: {
          referrerOrgId:              referrerOrg.id,
          referredOrgId:              org.id,
          referralCode:               ref!.toUpperCase(),
          signupDate:                 new Date(),
          source:                     source ?? "referral_link",
          programId:                  activeProgram?.id ?? null,
          qualificationMonthsRequired: activeProgram?.consecutiveMonthsRequired ?? 6,
        },
      }).catch(console.error) // don't block registration if referral creation fails
    }

    await createSession({
      userId: user.id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
      organizationId: user.organizationId,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

    // Test registrations skip welcome emails, CRM sync, and analytics to stay isolated
    if (!isTestRegistration) {
      sendEmail({
        to:      user.email,
        subject: "Welcome to Relay — Let's get you set up",
        html:    welcomeEmail({ name: user.name, orgName, setupUrl: `${appUrl}/onboarding` }),
      }).catch(console.error)

      logActivationEvent(org.id, "org_created").catch(() => {})

      // CRM sync runs after the response is sent so it never blocks registration.
      // `after()` is safe here — Vercel keeps the function alive until after() callbacks complete.
      after(async () => {
        try {
          await syncRegistrationToCrm({
            orgId:      org.id,
            orgName:    orgName!,
            adminEmail: user.email,
            adminName:  user.name,
            source:     referrerOrg ? "referral" : (source ?? "website_self_service"),
          })
        } catch (err) {
          console.error("[CRM sync] Failed for org", org.id, err)
        }
      })
    }

    const response = NextResponse.json({ success: true })

    // Consume the test token so it cannot be reused
    if (isTestRegistration) {
      response.cookies.set(TEST_REG_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      })
    }

    return response
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
