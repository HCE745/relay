import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"
import { sendEmail, whiteGloveInviteEmail } from "@/lib/email"
import { TRIAL_DAYS } from "@/lib/billing-config"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ── POST /api/super-admin/onboarding/[id]/launch ─────────────────────────────
// Validates, sends invitation, activates trial, marks org+onboarding as live.
// Requires status = "ready_to_launch" and a trialStartDate.
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Parse optional body: { force?: boolean } — force=true skips checklist warning
  const body = await req.json().catch(() => ({})) as { force?: boolean }

  const record = await prisma.customerOnboarding.findUnique({
    where: { id },
    include: { organization: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // ── Safety checks ──────────────────────────────────────────────────────────

  if (record.status === "live") {
    return NextResponse.json({ error: "This onboarding has already been launched." }, { status: 409 })
  }

  if (record.status !== "ready_to_launch") {
    return NextResponse.json(
      { error: `Status must be 'ready_to_launch' before launching (current: '${record.status}').` },
      { status: 400 },
    )
  }

  if (!record.trialStartDate) {
    return NextResponse.json(
      { error: "A trial start date must be set before launching." },
      { status: 400 },
    )
  }

  // Check for incomplete checklist items (warning, not hard block — force=true overrides)
  const checklist = record.checklist as Array<{ key: string; label: string; completedAt: string | null }>
  const incomplete = checklist.filter(item => !item.completedAt).map(i => i.label)
  if (incomplete.length > 0 && !body.force) {
    return NextResponse.json(
      {
        error:      "Some checklist items are not complete.",
        incomplete,
        canForce:   true,
        message:    "Pass { force: true } to launch anyway.",
      },
      { status: 422 },
    )
  }

  // ── Duplicate-send prevention ──────────────────────────────────────────────
  if (record.invitationSentAt) {
    return NextResponse.json(
      { error: "An invitation has already been sent for this onboarding." },
      { status: 409 },
    )
  }

  // Check the contact doesn't already have an account
  const existingUser = await prisma.user.findUnique({
    where: { email: record.primaryContactEmail },
  })
  if (existingUser) {
    return NextResponse.json(
      { error: "A user account already exists for this email address." },
      { status: 409 },
    )
  }

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const inviteToken  = randomUUID()
  const inviteExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const trialStart = new Date(record.trialStartDate)
  const trialEnd   = new Date(trialStart.getTime() + TRIAL_DAYS * 86400000)

  await prisma.$transaction(async (tx) => {
    // Create the invitation for the primary contact
    await tx.invitation.create({
      data: {
        organizationId: record.organizationId,
        email:          record.primaryContactEmail,
        token:          inviteToken,
        role:           "ADMIN",
        invitedById:    null, // super-admin initiated; no org user yet
        expiresAt:      inviteExpiry,
      },
    })

    // Activate the org: set subscription to trialing + trial dates
    await tx.organization.update({
      where: { id: record.organizationId },
      data: {
        subscriptionStatus: "trialing",
        trialStartDate:     trialStart,
        trialEndsAt:        trialEnd,
        plan:               record.plan,
      },
    })

    // Mark onboarding as live
    await tx.customerOnboarding.update({
      where: { id },
      data: {
        status:           "live",
        launchedAt:       new Date(),
        invitationSentAt: new Date(),
        invitationToken:  inviteToken,
        updatedAt:        new Date(),
      },
    })
  })

  // Send invitation email (after transaction commits)
  const inviteUrl = `${appUrl}/invite/${inviteToken}`
  await sendEmail({
    to:      record.primaryContactEmail,
    subject: `Your Relay account for ${record.organization.name} is ready`,
    html:    whiteGloveInviteEmail({
      name:       record.primaryContactName,
      orgName:    record.organization.name,
      inviteUrl,
      trialDays:  TRIAL_DAYS,
    }),
  }).catch(err => console.error("[launch] invitation email failed:", err))

  await logSAAction({
    superAdminId:   session.superAdminId!,
    superAdminName: session.name,
    action:         "LAUNCH_CUSTOMER_ONBOARDING",
    orgId:          record.organizationId,
    orgName:        record.organization.name,
    targetType:     "organization",
    targetId:       id,
    targetName:     record.organization.name,
    before: { status: record.status },
    after: {
      status:              "live",
      trialStartDate:      trialStart.toISOString(),
      trialEndsAt:         trialEnd.toISOString(),
      invitationSentTo:    record.primaryContactEmail,
      inviteToken,
    },
  })

  return NextResponse.json({
    ok:           true,
    status:       "live",
    trialStartDate: trialStart.toISOString(),
    trialEndsAt:    trialEnd.toISOString(),
    inviteUrl,
  })
}
