import "server-only"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

type Params = { params: Promise<{ id: string }> }

// Default checklist mirrors the manual New Onboarding flow
function defaultChecklist() {
  return [
    { key: "org_details",      label: "Org details confirmed (name, plan, location estimate)",   completedAt: null, completedByName: null },
    { key: "primary_location", label: "Primary location added in org settings",                   completedAt: null, completedByName: null },
    { key: "departments",      label: "Departments / areas configured",                           completedAt: null, completedByName: null },
    { key: "routing",          label: "Issue routing rules set up",                               completedAt: null, completedByName: null },
    { key: "trial_date",       label: "Trial start date agreed and recorded",                     completedAt: null, completedByName: null },
    { key: "internal_review",  label: "Internal readiness review complete",                       completedAt: null, completedByName: null },
  ]
}

// ── POST /api/super-admin/handoffs/[id]/accept ───────────────────────────────
// Accepts a pending_review handoff. Atomically:
//   1. Creates Organization (subscriptionStatus "draft")
//   2. Creates CustomerOnboarding (status "draft")
//   3. Sets Prospect.relayOrganizationId
//   4. Sets CrmOpportunity.customerOrganizationId (if linked)
//   5. Sets OnboardingHandoff.customerOnboardingId + status "accepted"
//
// No invitations, trial activation, emails, or Stripe operations.
// Does NOT mark the opportunity Closed Won.
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const handoff = await prisma.onboardingHandoff.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      prospectId: true,
      opportunityId: true,
      companyName: true,
      primaryContactName: true,
      primaryContactEmail: true,
      plan: true,
      estimatedFacilities: true,
      trialStartDate: true,
      salesNotes: true,
      isTest: true,
      prospect: { select: { id: true, companyName: true, relayOrganizationId: true } },
    },
  })

  if (!handoff) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (handoff.status !== "pending_review") {
    return NextResponse.json(
      { error: `Cannot accept a handoff with status '${handoff.status}'` },
      { status: 409 },
    )
  }

  // Idempotency guard: if the prospect already has an org, block to prevent duplicates
  if (handoff.prospect.relayOrganizationId) {
    return NextResponse.json(
      { error: "This prospect already has a customer organization. The handoff cannot be accepted again." },
      { status: 409 },
    )
  }

  const companyName = handoff.companyName
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" + Date.now().toString(36) + "-" + randomUUID().slice(0, 6)

  // ── Atomic transaction ────────────────────────────────────────────────────
  const { org, onboarding } = await prisma.$transaction(async (tx) => {
    // 1. Create Organization
    const newOrg = await tx.organization.create({
      data: {
        name:               companyName,
        slug,
        subscriptionStatus: "draft",
        plan:               handoff.plan,
        isDemo:             handoff.isTest,
      },
    })

    // 2. Create CustomerOnboarding (draft — no invitation or trial yet)
    const newOnboarding = await tx.customerOnboarding.create({
      data: {
        organizationId:      newOrg.id,
        status:              "draft",
        primaryContactName:  handoff.primaryContactName,
        primaryContactEmail: handoff.primaryContactEmail,
        plan:                handoff.plan,
        estimatedFacilities: handoff.estimatedFacilities,
        internalNotes:       handoff.salesNotes ?? null,
        ownerId:             session.superAdminId!,
        ownerName:           session.name ?? "Super Admin",
        checklist:           defaultChecklist(),
        trialStartDate:      handoff.trialStartDate ?? null,
      },
    })

    // 3. Link prospect to new org
    await tx.prospect.update({
      where: { id: handoff.prospectId },
      data: {
        relayOrganizationId: newOrg.id,
        onboardingStatus:    "in_progress",
      },
    })

    // 4. Link opportunity to new org (preserves ownership + history; does NOT close the deal)
    if (handoff.opportunityId) {
      await tx.crmOpportunity.update({
        where: { id: handoff.opportunityId },
        data:  { customerOrganizationId: newOrg.id },
      })
    }

    // 5. Mark handoff accepted and link to CustomerOnboarding
    await tx.onboardingHandoff.update({
      where: { id: handoff.id },
      data: {
        status:              "accepted",
        reviewedById:        session.superAdminId,
        reviewedByName:      session.name ?? "Super Admin",
        reviewedAt:          new Date(),
        customerOnboardingId: newOnboarding.id,
      },
    })

    return { org: newOrg, onboarding: newOnboarding }
  })

  await logSAAction({
    superAdminId:   session.superAdminId!,
    superAdminName: session.name,
    action:         "ACCEPT_ONBOARDING_HANDOFF",
    orgId:          org.id,
    orgName:        org.name,
    targetType:     "onboarding_handoff",
    targetId:       handoff.id,
    targetName:     companyName,
    after: {
      handoffId:           handoff.id,
      customerOnboardingId: onboarding.id,
      orgId:               org.id,
      plan:                handoff.plan,
      isTest:              handoff.isTest,
    },
  })

  return NextResponse.json({ customerOnboardingId: onboarding.id, organizationId: org.id })
}
