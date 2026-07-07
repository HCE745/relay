import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"

const VALID_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE", "HR"]

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.isDemo) {
    return NextResponse.json({ error: "Not a demo session" }, { status: 403 })
  }

  const { role } = await request.json() as { role: string }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  // Re-issue the session preserving all existing fields, only changing role
  await createSession({
    userId:              session.userId,
    email:               session.email,
    name:                session.name,
    role,
    organizationId:      session.organizationId,
    onboardingCompleted: true,
    subscriptionStatus:  "active",
    plan:                session.plan,
    isDemo:              true,
  })

  return NextResponse.json({ ok: true })
}
