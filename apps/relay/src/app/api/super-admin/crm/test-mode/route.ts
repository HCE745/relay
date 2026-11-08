import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// POST /api/super-admin/crm/test-mode
// Creates an isolated test organization for onboarding testing.
// The org is created with isDemo=true and a test Prospect with isTestRecord=true.
// Round-robin assignment is bypassed for test orgs.
export async function POST(request: NextRequest) {
  const sa = await requireSA()
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as {
    companyName?: string
    adminName?: string
    adminEmail?: string
    adminPassword?: string
  }

  const companyName   = typeof body.companyName  === "string" ? body.companyName.trim()  : ""
  const adminName     = typeof body.adminName    === "string" ? body.adminName.trim()     : ""
  const adminEmail    = typeof body.adminEmail   === "string" ? body.adminEmail.trim().toLowerCase() : ""
  const adminPassword = typeof body.adminPassword === "string" ? body.adminPassword : "TestRelay123!"

  if (!companyName || !adminName || !adminEmail) {
    return NextResponse.json(
      { error: "companyName, adminName, and adminEmail are required" },
      { status: 400 },
    )
  }

  // Safety: test emails should use a recognizable pattern
  if (!adminEmail.includes("+test") && !adminEmail.endsWith("@example.com") && !adminEmail.endsWith("@relay-test.internal")) {
    return NextResponse.json(
      { error: "adminEmail must include '+test', end with '@example.com', or '@relay-test.internal' for test accounts" },
      { status: 400 },
    )
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 })
  }

  const slug = `test-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`
  const hashedPassword = await bcrypt.hash(adminPassword, 12)

  // Create test org + user in a transaction
  const { org, user } = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: `[Test] ${companyName}`,
        slug,
        isDemo: true, // bypasses CRM sync, payment, outreach
      },
    })
    const newUser = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        organizationId: newOrg.id,
      },
    })
    return { org: newOrg, user: newUser }
  })

  // Create a test-flagged CRM prospect (not assigned via round-robin)
  const prospect = await prisma.prospect.create({
    data: {
      companyName: `[Test] ${companyName}`,
      source: "manual",
      currentCrmStatus: "trial",
      relayOrganizationId: org.id,
      registeredAt: new Date(),
      onboardingStatus: "not_started",
      onboardingLastActivityAt: new Date(),
      isTestRecord: true,
    },
  })

  await prisma.organization.update({
    where: { id: org.id },
    data: { crmProspectId: prospect.id },
  })

  // Create onboarding session ready to use
  await prisma.onboardingSession.create({
    data: { organizationId: org.id },
  })

  // Create an impersonation log so the SA can exit back via /api/super-admin/exit-impersonation
  const log = await prisma.impersonationLog.create({
    data: {
      superAdminId:   sa.superAdminId!,
      superAdminName: sa.name,
      organizationId: org.id,
      orgName:        org.name,
      targetUserId:   user.id,
      targetUserName: user.name,
    },
  })

  // Enter as the test admin; impersonatedBy lets exit-impersonation restore the SA session
  await createSession({
    userId:              user.id,
    email:               user.email,
    name:                user.name,
    role:                user.role,
    organizationId:      org.id,
    onboardingCompleted: false,
    superAdmin:          false,
    superAdminId:        sa.superAdminId,
    impersonatedBy:      sa.superAdminId,
    impersonatedByName:  sa.name,
    impersonatedOrgName: org.name,
    impersonationLogId:  log.id,
  })

  return NextResponse.json({
    message: "Test organization created. You are now in a test session. Visit /api/super-admin/exit-impersonation to return to your SA session.",
    testOrgId: org.id,
    testProspectId: prospect.id,
    testUserEmail: adminEmail,
    testPassword: adminPassword,
    onboardingUrl: `/onboarding`,
    exitUrl: `/api/super-admin/exit-impersonation`,
    cleanupUrl: `/api/super-admin/crm/test-mode?orgId=${org.id}`,
  })
}

// GET — list test organizations for review
export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const testOrgs = await prisma.organization.findMany({
    where: { isDemo: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      crmProspectId: true,
      onboardingSession: {
        select: { currentStage: true, completedAt: true, updatedAt: true },
      },
      users: {
        select: { id: true, name: true, email: true },
        take: 3,
      },
    },
  })

  return NextResponse.json({ testOrgs })
}

// DELETE /api/super-admin/crm/test-mode?orgId=X
// Cleans up a test organization and its associated test CRM records.
// Safety guards prevent deletion of genuine customer records.
export async function DELETE(request: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = request.nextUrl
  const orgId = searchParams.get("orgId")

  if (!orgId) {
    return NextResponse.json({ error: "orgId query param is required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, isDemo: true, crmProspectId: true },
  })

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  // Safety guard: only delete demo/test organizations
  if (!org.isDemo) {
    return NextResponse.json(
      { error: "Only test/demo organizations (isDemo=true) can be deleted via this endpoint. This is a genuine customer record." },
      { status: 403 },
    )
  }

  // Verify the linked prospect is a test record before deleting
  if (org.crmProspectId) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: org.crmProspectId },
      select: { isTestRecord: true },
    })
    if (prospect && !prospect.isTestRecord) {
      return NextResponse.json(
        { error: "The linked CRM prospect is not a test record. Manual review required before deletion." },
        { status: 403 },
      )
    }
  }

  // Delete in dependency order
  await prisma.$transaction(async (tx) => {
    // Clear the crmProspectId link first to avoid FK issues
    await tx.organization.update({ where: { id: orgId }, data: { crmProspectId: null } })

    // Delete test prospect and its children (cascade handles contacts/notes/tasks)
    if (org.crmProspectId) {
      await tx.crmTask.deleteMany({ where: { prospectId: org.crmProspectId } })
      await tx.salesCrmActivity.deleteMany({ where: { prospectId: org.crmProspectId } })
      await tx.prospectContact.deleteMany({ where: { prospectId: org.crmProspectId } })
      await tx.prospectNote.deleteMany({ where: { prospectId: org.crmProspectId } })
      await tx.prospect.delete({ where: { id: org.crmProspectId } })
    }

    // Delete org-scoped data (organization cascades will handle most)
    await tx.configurationAuditLog.deleteMany({ where: { organizationId: orgId } })
    await tx.onboardingSession.deleteMany({ where: { organizationId: orgId } })
    await tx.crmActivity.deleteMany({ where: { organizationId: orgId } })
    await tx.user.deleteMany({ where: { organizationId: orgId } })
    await tx.organization.delete({ where: { id: orgId } })
  })

  return NextResponse.json({
    message: `Test organization "${org.name}" and its associated test records have been deleted.`,
    deletedOrgId: orgId,
  })
}
