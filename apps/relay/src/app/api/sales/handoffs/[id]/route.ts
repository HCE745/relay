export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

const HANDOFF_DETAIL_SELECT = {
  id: true,
  companyName: true,
  primaryContactName: true,
  primaryContactEmail: true,
  primaryContactPhone: true,
  onboardingType: true,
  isTest: true,
  plan: true,
  estimatedFacilities: true,
  trialStartDate: true,
  salesNotes: true,
  customerAgreementConfirmed: true,
  status: true,
  submittedById: true,
  submittedByName: true,
  reviewedById: true,
  reviewedByName: true,
  reviewedAt: true,
  rejectionReason: true,
  customerOnboardingId: true,
  createdAt: true,
  updatedAt: true,
  prospect: {
    select: {
      id: true, companyName: true, onboardingStatus: true, relayOrganizationId: true,
      assignedToId: true,
    },
  },
  opportunity: {
    select: { id: true, title: true, stage: true, assignedToId: true },
  },
} as const

// ── GET /api/sales/handoffs/[id] ─────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isDemo || info.isCrmImpersonation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const handoff = await prisma.onboardingHandoff.findUnique({
    where: { id },
    select: HANDOFF_DETAIL_SELECT,
  })

  if (!handoff) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // sales_rep can only view own submissions
  if (info.isRep && handoff.submittedById !== info.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Enrich with downstream onboarding status (sales-visible — no CustomerOnboarding detail)
  let downstreamOnboardingStatus: string | null = null
  if (handoff.customerOnboardingId) {
    const co = await prisma.customerOnboarding.findUnique({
      where:  { id: handoff.customerOnboardingId },
      select: { status: true },
    })
    downstreamOnboardingStatus = co?.status ?? null
  }

  return NextResponse.json({ ...handoff, downstreamOnboardingStatus })
}

// ── DELETE /api/sales/handoffs/[id] ──────────────────────────────────────────
// Cancel a pending_review handoff. Only the submitting user may cancel.
// Resets Prospect.onboardingStatus to not_started.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isDemo || info.isCrmImpersonation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const handoff = await prisma.onboardingHandoff.findUnique({
    where:  { id },
    select: { id: true, status: true, submittedById: true, prospectId: true },
  })

  if (!handoff) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only the submitter can cancel (SA cannot cancel on behalf)
  if (handoff.submittedById !== info.salesUserId) {
    return NextResponse.json({ error: "Forbidden: only the submitter may cancel this request" }, { status: 403 })
  }

  if (handoff.status !== "pending_review") {
    return NextResponse.json(
      { error: `Cannot cancel a handoff with status '${handoff.status}'` },
      { status: 409 },
    )
  }

  await prisma.$transaction([
    prisma.onboardingHandoff.update({
      where: { id },
      data:  { status: "cancelled" },
    }),
    prisma.prospect.update({
      where: { id: handoff.prospectId },
      data:  { onboardingStatus: "not_started" },
    }),
  ])

  return NextResponse.json({ ok: true })
}
