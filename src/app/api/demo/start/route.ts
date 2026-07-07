import { NextRequest, NextResponse } from "next/server"
import { createSession, getSession } from "@/lib/session"
import { cleanupExpiredDemos, createDemoOrg, resetDemoOrg } from "@/lib/demo-seed"
import { getPlatformConfig } from "@/lib/platform-config"

export async function POST(request: NextRequest) {
  const existing = await getSession()

  let body: { accessCode?: string; superAdminBypass?: boolean; industry?: string } = {}
  try { body = await request.json() } catch { /* empty body */ }

  if (existing?.isDemo && !existing.superAdmin) {
    const requestedIndustry = body.industry?.trim()
    if (requestedIndustry) {
      await resetDemoOrg(existing.organizationId, existing.userId, requestedIndustry)
    }
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

  await cleanupExpiredDemos()

  // Always start as Professional — salesperson switches in the demo control panel
  const industry = body.industry?.trim() || undefined
  const { org, user } = await createDemoOrg(industry, "professional")

  await createSession({
    userId:              user.id,
    email:               user.email,
    name:                user.name,
    role:                "ADMIN",
    organizationId:      org.id,
    onboardingCompleted: true,
    subscriptionStatus:  "active",
    plan:                "pro",
    isDemo:              true,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
