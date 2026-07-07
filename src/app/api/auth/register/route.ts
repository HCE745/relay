import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import { sendEmail, welcomeEmail } from "@/lib/email"
import { checkLimit, getIP, limiters } from "@/lib/ratelimit"
import { generateUniqueReferralCode, buildReferralLink } from "@/lib/billing-credits-engine"

export async function POST(request: NextRequest) {
  const blocked = await checkLimit(
    limiters.register,
    `register:${getIP(request)}`,
    "Too many registration attempts. Please try again in an hour.",
  )
  if (blocked) return blocked

  try {
    const body = await request.json()
    const { name, email, password, orgName, ref } = body as {
      name?: string; email?: string; password?: string; orgName?: string; ref?: string
    }

    if (!name || !email || !password || !orgName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

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

    // Look up referrer if ref= param provided
    let referrerOrg: { id: string } | null = null
    if (ref) {
      referrerOrg = await prisma.organization.findUnique({
        where: { referralCode: ref.toUpperCase() },
        select: { id: true },
      })
    }

    const org = await prisma.organization.create({
      data: { name: orgName, slug, referralCode, referralLink },
    })

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: "ADMIN", organizationId: org.id },
    })

    // Create referral record if came through a valid referral link
    if (referrerOrg) {
      await prisma.referral.create({
        data: {
          referrerOrgId: referrerOrg.id,
          referredOrgId: org.id,
          referralCode:  ref!.toUpperCase(),
          signupDate:    new Date(),
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
    sendEmail({
      to:      user.email,
      subject: "Welcome to Relay — Let's get you set up",
      html:    welcomeEmail({ name: user.name, orgName, setupUrl: `${appUrl}/onboarding` }),
    }).catch(console.error)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
