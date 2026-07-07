import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { action, days } = await req.json() as { action: string; days?: number }

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const now = new Date()
  const update: { trialEndsAt?: Date | null; subscriptionStatus?: string } = {}
  const before: Record<string, unknown> = {
    trialEndsAt:        org.trialEndsAt?.toISOString() ?? null,
    subscriptionStatus: org.subscriptionStatus,
  }

  if (action === "extend") {
    const base = org.trialEndsAt && org.trialEndsAt > now ? org.trialEndsAt : now
    update.trialEndsAt        = new Date(base.getTime() + (days ?? 14) * 86400000)
    update.subscriptionStatus = "trialing"
  } else if (action === "reset") {
    update.trialEndsAt        = new Date(now.getTime() + 14 * 86400000)
    update.subscriptionStatus = "trialing"
  } else if (action === "end") {
    update.trialEndsAt        = new Date(now.getTime() - 1)
    update.subscriptionStatus = "trialing"
  } else if (action === "activate") {
    update.subscriptionStatus = "active"
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  await prisma.organization.update({ where: { id }, data: update })

  await logSAAction({
    superAdminId:   session.superAdminId,
    superAdminName: session.name,
    action:         "UPDATE_TRIAL",
    orgId:          org.id,
    orgName:        org.name,
    targetType:     "organization",
    targetId:       org.id,
    targetName:     org.name,
    before,
    after: {
      trialEndsAt:        update.trialEndsAt?.toISOString() ?? before.trialEndsAt,
      subscriptionStatus: update.subscriptionStatus ?? before.subscriptionStatus,
      trialAction:        action,
    },
  })

  return NextResponse.json({ success: true })
}
