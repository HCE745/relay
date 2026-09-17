import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

function inviteHtml(orgName: string, inviteUrl: string, inviteeName?: string): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <div style="margin-bottom:24px">
    <span style="font-weight:700;font-size:20px;color:#2563eb">Relay</span>
  </div>
  <h2 style="margin:0 0 8px;font-size:18px">You've been invited to join ${orgName}</h2>
  <p style="color:#555;margin:0 0 24px">
    ${inviteeName ? `Hi ${inviteeName}, ` : ""}Click below to set up your account. This link expires in 72 hours.
  </p>
  <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600">Accept Invitation →</a>
</div>`.trim()
}

// Map issue type labels to Relay categories and department names
const ISSUE_TYPE_MAP: Record<string, { category: string; dept: string | null }> = {
  "Maintenance":         { category: "MAINTENANCE",        dept: "Maintenance" },
  "Operations":          { category: "GENERAL",            dept: "Operations" },
  "Safety":              { category: "SAFETY",             dept: "Safety" },
  "Customer Complaints": { category: "CUSTOMER_COMPLAINT", dept: "Customer Service" },
  "Purchasing":          { category: "SUPPLY_SHORTAGE",    dept: "Purchasing" },
  "IT":                  { category: "FACILITY",           dept: "Information Technology" },
  "Facilities":          { category: "FACILITY",           dept: "Facilities" },
  "HR":                  { category: "EMPLOYEE",           dept: "Human Resources" },
  "Quality Control":     { category: "EQUIPMENT_BREAKDOWN",dept: "Quality Control" },
  "Other":               { category: "GENERAL",            dept: null },
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    companyName,
    industry,
    companySize,
    numberOfLocations,
    packagePlan,
    issueTypes = [],
    locations = [],
    employeeTypeDefs = [],
    team = [],
    routing = {},
  } = body as {
    companyName?: string
    industry?: string
    companySize?: string
    numberOfLocations?: string
    packagePlan?: string
    issueTypes?: string[]
    locations?: Array<{ name: string; address?: string; locationType?: string }>
    employeeTypeDefs?: Array<{
      id: string
      name: string
      baseRole: string
      pageAccess: string[]
      actions?: string[]
      presetKey: string | null
      canInvite: boolean
      canChangeEmail: boolean
    }>
    team?: Array<{ title: string; role: string; name: string; email: string; employeeTypeId?: string }>
    routing?: Record<string, string>
  }

  const orgId = session.organizationId
  const isValidWashEssentialsPlan = packagePlan === "wash_essentials" && industry === "Car Wash"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Collect emails to send after the transaction commits
  const pendingEmails: Array<{ to: string; subject: string; html: string }> = []

  const updatedOrg = await prisma.$transaction(async (tx) => {
    // ── 1. Update organization (without onboardingCompletedAt — set last) ────
    await tx.organization.update({
      where: { id: orgId },
      data: {
        name:              companyName?.trim() || undefined,
        companySize:       companySize          || null,
        industry:          industry             || null,
        numberOfLocations: numberOfLocations    || null,
        ...(isValidWashEssentialsPlan
          ? { plan: "wash_essentials", productLine: "WASH_ESSENTIALS" }
          : {}),
      },
    })

    // ── 2. Create locations ───────────────────────────────────────────────────
    for (const loc of locations) {
      if (!loc.name?.trim()) continue
      await tx.location.create({
        data: {
          organizationId: orgId,
          name:         loc.name.trim(),
          locationType: loc.locationType || null,
          address:      loc.address?.trim() || null,
        },
      })
    }

    // ── 3. Create departments for selected issue types ────────────────────────
    const deptNames = new Set<string>()
    for (const label of issueTypes as string[]) {
      const mapped = ISSUE_TYPE_MAP[label]
      if (mapped?.dept) deptNames.add(mapped.dept)
    }
    for (const name of deptNames) {
      const existing = await tx.department.findFirst({ where: { organizationId: orgId, name } })
      if (!existing) {
        await tx.department.create({ data: { organizationId: orgId, name } })
      }
    }

    // ── 3.5. Create employee types ────────────────────────────────────────────
    for (const def of employeeTypeDefs) {
      if (!def.name?.trim()) continue
      const existing = def.presetKey
        ? await tx.employeeType.findFirst({ where: { organizationId: orgId, presetKey: def.presetKey } })
        : await tx.employeeType.findFirst({ where: { organizationId: orgId, name: def.name.trim() } })
      if (!existing) {
        await tx.employeeType.create({
          data: {
            organizationId: orgId,
            name:           def.name.trim(),
            baseRole:       def.baseRole || "EMPLOYEE",
            pageAccess:     def.pageAccess ?? [],
            actions:        def.actions ?? [],
            canInvite:      def.canInvite ?? false,
            canChangeEmail: def.canChangeEmail ?? true,
            isPreset:       !!def.presetKey,
            presetKey:      def.presetKey ?? null,
          },
        })
      }
    }

    // ── 4. Create invitations (collect emails for post-commit send) ───────────
    const org = await tx.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    for (const member of team as Array<{ title: string; role: string; name: string; email: string; employeeTypeId?: string }>) {
      const email = member.email?.trim()
      if (!email) continue
      const existingUser = await tx.user.findUnique({ where: { email } })
      if (existingUser) continue
      const alreadyInvited = await tx.invitation.findFirst({ where: { organizationId: orgId, email, usedAt: null } })
      if (alreadyInvited) continue

      let inviteRole = member.role || "EMPLOYEE"
      if (member.employeeTypeId) {
        const typeDef = employeeTypeDefs.find(d => d.id === member.employeeTypeId)
        if (typeDef?.baseRole) inviteRole = typeDef.baseRole
      }

      const token     = randomUUID()
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
      await tx.invitation.create({
        data: {
          organizationId: orgId,
          email,
          token,
          role:        inviteRole,
          invitedById: session.userId,
          expiresAt,
        },
      })
      const inviteUrl = `${appUrl}/invite/${token}`
      pendingEmails.push({
        to:      email,
        subject: `You've been invited to join ${org?.name ?? "Relay"}`,
        html:    inviteHtml(org?.name ?? "Relay", inviteUrl, member.name?.trim() || undefined),
      })
    }

    // ── 5. Create routing rules ───────────────────────────────────────────────
    for (const [category, assignment] of Object.entries(routing as Record<string, string>)) {
      if (!assignment) continue

      let assignToRole: string | null   = null
      let assignToUserId: string | null = null
      let ruleName = `${category} routing`

      if (assignment.startsWith("role:")) {
        assignToRole = assignment.slice(5)
      } else if (assignment.startsWith("user:")) {
        const email = assignment.slice(5)
        const user  = await tx.user.findUnique({ where: { email } })
        if (user) assignToUserId = user.id
        else assignToRole = "MANAGER"
        ruleName = `${category} → ${email}`
      } else {
        assignToRole = assignment
      }

      const existing = await tx.routingRule.findFirst({
        where: { organizationId: orgId, condCategory: category, name: { startsWith: category } },
      })
      if (!existing) {
        await tx.routingRule.create({
          data: {
            organizationId: orgId,
            name:           ruleName,
            condCategory:   category,
            assignToRole,
            assignToUserId,
          },
        })
      }
    }

    // ── 6. Mark onboarding complete — final write in transaction ─────────────
    return tx.organization.update({
      where:  { id: orgId },
      data:   { onboardingCompletedAt: new Date() },
      select: { plan: true, productLine: true },
    })
  })

  // Send invitation emails after transaction commits
  for (const mail of pendingEmails) {
    await sendEmail(mail).catch(() => {})
  }

  // ── Refresh session ───────────────────────────────────────────────────────
  await createSession({
    userId:              session.userId,
    email:               session.email,
    name:                session.name,
    role:                session.role,
    organizationId:      orgId,
    onboardingCompleted: true,
    trialEndsAt:         session.trialEndsAt,
    subscriptionStatus:  session.subscriptionStatus,
    plan:                updatedOrg.plan ?? session.plan,
    productLine:         updatedOrg.productLine ?? session.productLine,
  })

  return NextResponse.json({ success: true })
}
