import { NextRequest, NextResponse } from "next/server"
import { createSession, getSession } from "@/lib/session"
import { cleanupExpiredDemos, createDemoOrg, resetDemoOrg } from "@/lib/demo-seed"
import { getPlatformConfig } from "@/lib/platform-config"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const existing = await getSession()

  let body: { accessCode?: string; superAdminBypass?: boolean; industry?: string } = {}
  try { body = await request.json() } catch { /* empty body */ }

  if (existing?.isDemo && !existing.superAdmin) {
    const requestedIndustry = body.industry?.trim()
    const isCarWash = requestedIndustry === "Car Wash"
    const pkg = isCarWash ? "wash_essentials" : "professional_plus"
    await resetDemoOrg(existing.organizationId, existing.userId, requestedIndustry, pkg)
    // Guarantee customer_voice_enabled regardless of seed data
    await prisma.organization.update({
      where: { id: existing.organizationId },
      data:  { customer_voice_enabled: true },
    })
    await createSession({
      userId:              existing.userId,
      email:               existing.email,
      name:                existing.name,
      role:                existing.role,
      organizationId:      existing.organizationId,
      onboardingCompleted: true,
      subscriptionStatus:  "active",
      plan:                isCarWash ? "wash_essentials" : "professional_plus",
      productLine:         isCarWash ? "WASH_ESSENTIALS" : undefined,
      isDemo:              true,
    })
    return NextResponse.json({ ok: true })
  }

  const isSuperAdmin = existing?.superAdmin === true

  if (!isSuperAdmin && !body.superAdminBypass) {
    const requiredCode = await getPlatformConfig("demo_access_code")
    if (requiredCode) {
      if (!body.accessCode || body.accessCode.trim() !== requiredCode) {
        return NextResponse.json({ error: "Invalid access code" }, { status: 403 })
      }
    }
  }

  try {
    await cleanupExpiredDemos()
  } catch (cleanupErr) {
    console.error("[demo/start] cleanupExpiredDemos failed:", cleanupErr)
    // Non-fatal: stale demo orgs remain but we can still create a new one
  }

  const industry = body.industry?.trim() || undefined
  const isCarWash = industry === "Car Wash"
  const pkg = isCarWash ? "wash_essentials" : "professional_plus"

  const created = await createDemoOrg(industry, pkg).catch((seedErr: unknown) => {
    console.error("[demo/start] createDemoOrg failed:", seedErr)
    return null
  })
  if (!created) return NextResponse.json({ error: "Demo creation failed" }, { status: 500 })
  const { org, user } = created

  // Guarantee customer_voice_enabled regardless of seed data
  await prisma.organization.update({
    where: { id: org.id },
    data:  { customer_voice_enabled: true },
  })

  await createSession({
    userId:              user.id,
    email:               user.email,
    name:                user.name,
    role:                "ADMIN",
    organizationId:      org.id,
    onboardingCompleted: true,
    subscriptionStatus:  "active",
    plan:                isCarWash ? "wash_essentials" : "professional_plus",
    productLine:         isCarWash ? "WASH_ESSENTIALS" : undefined,
    isDemo:              true,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
