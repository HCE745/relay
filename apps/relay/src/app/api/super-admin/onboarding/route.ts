import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

export const dynamic = "force-dynamic"

// Default checklist every new onboarding starts with
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

// ── GET /api/super-admin/onboarding ─────────────────────────────────────────
export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const records = await prisma.customerOnboarding.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organization: {
        select: { id: true, name: true, subscriptionStatus: true, plan: true, isDemo: true },
      },
    },
  })

  return NextResponse.json(records)
}

// ── POST /api/super-admin/onboarding ────────────────────────────────────────
// Creates a draft onboarding record and the associated Organization.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    companyName?:         string
    primaryContactName?:  string
    primaryContactEmail?: string
    plan?:                string
    estimatedFacilities?: number
    internalNotes?:       string
    trialStartDate?:      string
    isTest?:              boolean // when true: org.isDemo=true, bypasses CRM sync
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 })
  }
  if (!body.primaryContactName?.trim()) {
    return NextResponse.json({ error: "primaryContactName is required" }, { status: 400 })
  }
  if (!body.primaryContactEmail?.trim()) {
    return NextResponse.json({ error: "primaryContactEmail is required" }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.primaryContactEmail.trim())) {
    return NextResponse.json({ error: "primaryContactEmail is not a valid email address" }, { status: 400 })
  }

  // Test orgs require a recognizably-fake email to prevent accidentally marking real customers
  if (body.isTest) {
    const e = body.primaryContactEmail.trim().toLowerCase()
    if (!e.includes("+test") && !e.endsWith("@example.com") && !e.endsWith("@relay-test.internal")) {
      return NextResponse.json(
        { error: "Test organizations require a test email address (must contain '+test', end with '@example.com', or '@relay-test.internal')." },
        { status: 400 },
      )
    }
  }

  const companyName  = body.companyName.trim()
  const contactEmail = body.primaryContactEmail.trim().toLowerCase()
  const contactName  = body.primaryContactName.trim()
  const plan         = body.plan ?? "essentials"

  // ── Duplicate prevention ───────────────────────────────────────────────────
  // Block if the contact email already has a registered user account
  const existingUser = await prisma.user.findUnique({ where: { email: contactEmail } })
  if (existingUser) {
    return NextResponse.json(
      { error: "A user account already exists for this email address. This customer may already be registered." },
      { status: 409 },
    )
  }

  // Block if there is already an open (non-live, non-canceled) onboarding for the same email
  const existingOnboarding = await prisma.customerOnboarding.findFirst({
    where: { primaryContactEmail: contactEmail, status: { notIn: ["live", "canceled"] } },
  })
  if (existingOnboarding) {
    return NextResponse.json(
      { error: "An active onboarding record already exists for this contact email." },
      { status: 409 },
    )
  }

  // ── Create org + onboarding in a transaction ───────────────────────────────
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" + Date.now().toString(36)

  const { org, onboarding } = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name:               companyName,
        slug:               slug + "-" + randomUUID().slice(0, 6),
        subscriptionStatus: "draft",
        plan,
        isDemo:             body.isTest === true,
      },
    })

    const newOnboarding = await tx.customerOnboarding.create({
      data: {
        organizationId:      newOrg.id,
        status:              "draft",
        primaryContactName:  contactName,
        primaryContactEmail: contactEmail,
        plan,
        estimatedFacilities: typeof body.estimatedFacilities === "number" ? body.estimatedFacilities : 1,
        internalNotes:       body.internalNotes?.trim() ?? null,
        ownerId:             session.superAdminId!,
        ownerName:           session.name,
        checklist:           defaultChecklist(),
        trialStartDate:      body.trialStartDate ? new Date(body.trialStartDate) : null,
      },
    })

    return { org: newOrg, onboarding: newOnboarding }
  })

  await logSAAction({
    superAdminId:   session.superAdminId!,
    superAdminName: session.name,
    action:         "CREATE_CUSTOMER_ONBOARDING",
    orgId:          org.id,
    orgName:        org.name,
    targetType:     "organization",
    targetId:       onboarding.id,
    targetName:     companyName,
    after: {
      status:              "draft",
      primaryContactEmail: contactEmail,
      plan,
    },
  })

  return NextResponse.json({ onboarding, organization: org }, { status: 201 })
}
