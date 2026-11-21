export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

const VALID_PLANS = ["essentials", "professional", "custom"]
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── GET /api/sales/handoffs ──────────────────────────────────────────────────
// sales_rep: own submissions only. admin_sales / SA: all submissions.
export async function GET(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isDemo || info.isCrmImpersonation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get("status") // optional filter

  const where = {
    ...(info.isSuperAdmin || info.isManager ? {} : { submittedById: info.salesUserId }),
    ...(statusFilter ? { status: statusFilter } : {}),
  }

  const handoffs = await prisma.onboardingHandoff.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      onboardingType: true,
      isTest: true,
      status: true,
      plan: true,
      submittedById: true,
      submittedByName: true,
      reviewedAt: true,
      rejectionReason: true,
      customerOnboardingId: true,
      createdAt: true,
      updatedAt: true,
      prospect: { select: { id: true, companyName: true, onboardingStatus: true } },
      opportunity: { select: { id: true, title: true, stage: true } },
    },
  })

  // Enrich with downstream onboarding status for accepted handoffs
  const customerOnboardingIds = handoffs
    .filter(h => h.customerOnboardingId)
    .map(h => h.customerOnboardingId!)

  const onboardings = customerOnboardingIds.length > 0
    ? await prisma.customerOnboarding.findMany({
        where: { id: { in: customerOnboardingIds } },
        select: { id: true, status: true },
      })
    : []

  const onboardingMap = new Map(onboardings.map(o => [o.id, o.status]))

  const result = handoffs.map((h) => ({
    ...h,
    downstreamOnboardingStatus: h.customerOnboardingId
      ? (onboardingMap.get(h.customerOnboardingId) ?? null)
      : null,
  }))

  return NextResponse.json(result)
}

// ── POST /api/sales/handoffs ─────────────────────────────────────────────────
// Submit a new white-glove handoff request. White-glove only in this phase;
// self-service handoffs are deferred. Does NOT create org, send email, or trigger billing.
export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isDemo || info.isCrmImpersonation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    prospectId?:               string
    opportunityId?:            string
    companyName?:              string
    primaryContactName?:       string
    primaryContactEmail?:      string
    primaryContactPhone?:      string
    plan?:                     string
    estimatedFacilities?:      number
    trialStartDate?:           string
    salesNotes?:               string
    customerAgreementConfirmed?: boolean
    isTest?:                   boolean
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!body.prospectId?.trim()) {
    return NextResponse.json({ error: "prospectId is required" }, { status: 400 })
  }
  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 })
  }
  if (!body.primaryContactName?.trim()) {
    return NextResponse.json({ error: "primaryContactName is required" }, { status: 400 })
  }
  if (!body.primaryContactEmail?.trim()) {
    return NextResponse.json({ error: "primaryContactEmail is required" }, { status: 400 })
  }
  if (!EMAIL_RE.test(body.primaryContactEmail.trim())) {
    return NextResponse.json({ error: "primaryContactEmail is not a valid email" }, { status: 400 })
  }
  if (!body.customerAgreementConfirmed) {
    return NextResponse.json({ error: "customerAgreementConfirmed must be true" }, { status: 400 })
  }
  const plan = body.plan ?? "essentials"
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: `plan must be one of: ${VALID_PLANS.join(", ")}` }, { status: 400 })
  }

  // Test org email validation (mirrors CustomerOnboarding test-mode rules)
  if (body.isTest) {
    const e = body.primaryContactEmail.trim().toLowerCase()
    if (!e.includes("+test") && !e.endsWith("@example.com") && !e.endsWith("@relay-test.internal")) {
      return NextResponse.json(
        { error: "Test handoffs require a test email address (must contain '+test', end with '@example.com', or '@relay-test.internal')." },
        { status: 400 },
      )
    }
  }

  // ── Prospect ownership check ─────────────────────────────────────────────
  const prospect = await prisma.prospect.findUnique({
    where: { id: body.prospectId },
    select: { id: true, companyName: true, assignedToId: true, onboardingStatus: true, relayOrganizationId: true },
  })
  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 })
  }
  // sales_rep can only submit for their own assigned prospects
  if (info.isRep && prospect.assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Forbidden: prospect is not assigned to you" }, { status: 403 })
  }
  // Prospect already has an org (accepted handoff already created it)
  if (prospect.relayOrganizationId) {
    return NextResponse.json(
      { error: "This prospect already has a customer organization. Contact your onboarding team." },
      { status: 409 },
    )
  }

  // ── Opportunity validation ───────────────────────────────────────────────
  if (body.opportunityId) {
    const opp = await prisma.crmOpportunity.findUnique({
      where: { id: body.opportunityId },
      select: { id: true, prospectId: true },
    })
    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
    }
    if (opp.prospectId !== body.prospectId) {
      return NextResponse.json({ error: "Opportunity does not belong to this prospect" }, { status: 400 })
    }
  }

  // ── Create handoff ───────────────────────────────────────────────────────
  // The partial unique index on (prospectId WHERE status='pending_review') is the
  // concurrency-safe guard. If a concurrent insert races here, the DB rejects it.
  //
  // opportunityId has a full unique constraint. To allow re-submission after
  // rejection or cancellation with the same opportunity, we release the slot first.
  if (body.opportunityId) {
    await prisma.onboardingHandoff.updateMany({
      where: { opportunityId: body.opportunityId, status: { in: ["rejected", "cancelled"] } },
      data:  { opportunityId: null },
    })
  }

  try {
    const handoff = await prisma.onboardingHandoff.create({
      data: {
        prospectId:                body.prospectId,
        opportunityId:             body.opportunityId ?? undefined,
        submittedById:             info.salesUserId,
        submittedByName:           info.salesUserName,
        onboardingType:            "white_glove",
        isTest:                    body.isTest === true,
        companyName:               body.companyName.trim(),
        primaryContactName:        body.primaryContactName.trim(),
        primaryContactEmail:       body.primaryContactEmail.trim().toLowerCase(),
        primaryContactPhone:       body.primaryContactPhone?.trim() ?? undefined,
        plan,
        estimatedFacilities:       body.estimatedFacilities ?? 1,
        trialStartDate:            body.trialStartDate ? new Date(body.trialStartDate) : undefined,
        salesNotes:                body.salesNotes?.trim() ?? undefined,
        customerAgreementConfirmed: true,
        status:                    "pending_review",
      },
    })

    // Update prospect onboarding status to in_progress
    await prisma.prospect.update({
      where: { id: body.prospectId },
      data:  { onboardingStatus: "in_progress" },
    })

    return NextResponse.json({ handoff }, { status: 201 })
  } catch (err: unknown) {
    // Unique constraint violation on the partial index → concurrent duplicate
    if (
      typeof err === "object" && err !== null && "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A pending onboarding request already exists for this prospect." },
        { status: 409 },
      )
    }
    console.error("[POST /api/sales/handoffs]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
