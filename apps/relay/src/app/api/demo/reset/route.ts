import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { resetDemoOrg } from "@/lib/demo-seed"
import type { DemoPackage } from "@/lib/demo-seed"

const PLAN_TO_PKG: Record<string, DemoPackage> = {
  professional_plus: "professional_plus",
  pro:               "professional",
  essentials:        "essentials",
  wash_essentials:   "wash_essentials",
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.isDemo) {
    return NextResponse.json({ error: "Not a demo session" }, { status: 403 })
  }

  let industry: string | undefined
  try {
    const body = await request.json() as { industry?: string }
    industry = body.industry?.trim() || undefined
  } catch {
    // body is optional
  }

  // Car Wash industry always uses wash_essentials package; all others preserve current package
  const isCarWash = (industry ?? "") === "Car Wash" || (!industry && (session.plan === "wash_essentials"))
  const pkg: DemoPackage = isCarWash
    ? "wash_essentials"
    : (PLAN_TO_PKG[session.plan ?? "professional_plus"] ?? "professional_plus")
  await resetDemoOrg(session.organizationId, session.userId, industry, pkg)

  // Re-issue JWT so plan-gated pages reflect the reset package correctly
  await createSession({
    userId:              session.userId,
    email:               session.email,
    name:                session.name,
    role:                session.role,
    organizationId:      session.organizationId,
    onboardingCompleted: true,
    subscriptionStatus:  "active",
    plan:                pkg === "professional" ? "pro" : pkg,
    productLine:         isCarWash ? "WASH_ESSENTIALS" : undefined,
    isDemo:              true,
  })

  return NextResponse.json({ ok: true })
}
