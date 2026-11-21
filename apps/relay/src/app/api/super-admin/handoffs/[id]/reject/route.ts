import "server-only"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

type Params = { params: Promise<{ id: string }> }

// ── POST /api/super-admin/handoffs/[id]/reject ───────────────────────────────
// Rejects a pending_review handoff. Requires a rejectionReason.
// Resets Prospect.onboardingStatus to not_started so the sales rep can re-submit.
// Does not create or modify any Organization or CustomerOnboarding records.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const body = await req.json() as { reason?: string }
  if (!body.reason?.trim()) {
    return NextResponse.json({ error: "reason is required when rejecting a handoff" }, { status: 400 })
  }

  const handoff = await prisma.onboardingHandoff.findUnique({
    where:  { id },
    select: { id: true, status: true, prospectId: true, companyName: true },
  })

  if (!handoff) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (handoff.status !== "pending_review") {
    return NextResponse.json(
      { error: `Cannot reject a handoff with status '${handoff.status}'` },
      { status: 409 },
    )
  }

  await prisma.$transaction([
    prisma.onboardingHandoff.update({
      where: { id },
      data: {
        status:         "rejected",
        reviewedById:   session.superAdminId,
        reviewedByName: session.name ?? "Super Admin",
        reviewedAt:     new Date(),
        rejectionReason: body.reason.trim(),
      },
    }),
    prisma.prospect.update({
      where: { id: handoff.prospectId },
      data:  { onboardingStatus: "not_started" },
    }),
  ])

  await logSAAction({
    superAdminId:   session.superAdminId!,
    superAdminName: session.name,
    action:         "REJECT_ONBOARDING_HANDOFF",
    orgId:          "none",
    orgName:        handoff.companyName,
    targetType:     "onboarding_handoff",
    targetId:       handoff.id,
    targetName:     handoff.companyName,
    after: { status: "rejected", reason: body.reason.trim() },
  })

  return NextResponse.json({ ok: true })
}
