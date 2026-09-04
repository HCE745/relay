import { NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { setLifecycle } from "@/lib/crm-lifecycle"

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now          = new Date()
  const trialEndsAt  = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { lifecycleStatus: true },
  })

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      subscriptionStatus: "trialing",
      trialStartDate:     now,
      trialEndsAt,
    },
  })

  await setLifecycle(session.organizationId, "Trial Started", "System", org?.lifecycleStatus)

  // Refresh session with updated trial info
  await createSession({
    ...session,
    subscriptionStatus: "trialing",
    trialEndsAt:        trialEndsAt.toISOString(),
    plan:               session.plan ?? "essentials",
  })

  return NextResponse.json({ success: true })
}
