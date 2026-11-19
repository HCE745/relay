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
//
// Sends the invitation and activates the trial.
// Sets onboarding status → "invitation_sent" (NOT "live").
// "Live" is a separate, explicit SA action (PATCH status=live) after the
// customer has set up their account.
//
// Trial clock: trialEndsAt = trialStartDate + TRIAL_DAYS (not "now + TRIAL_DAYS"),
// so a future trialStartDate is honoured. subscriptionStatus is set to "trialing"
// immediately so the customer can start using Relay when they accept the
// invitation; the trial simply ends on the agreed calendar date.
//
// Atomicity: DB writes are in a transaction. Email is sent after commit.
// If email delivery fails the invitation token is stored so the SA can resend
// via POST /onboarding/[id]/resend-invitation without creating a duplicate org
// or re-activating the trial.
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { force?: boolean }

  const record = await prisma.customerOnboarding.findUnique({
    where:   { id },
    include: { organization: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // ── Safety checks ──────────────────────────────────────────────────────────

  if (record.status === "live" || record.status === "invitation_sent") {
    return NextResponse.json(
      { error: `Cannot launch: status is already '${record.status}'. Use /resend-invitation to resend.` },
      { status: 409 },
    )
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

  // ── Checklist warning (non-blocking, force=true overrides) ─────────────────
  const checklist = record.checklist as Array<{ key: string; label: string; completedAt: string | null }>
  const incomplete = checklist.filter(item => !item.completedAt).map(i => i.label)
  if (incomplete.length > 0 && !body.force) {
    return NextResponse.json(
      {
        error:    "Some checklist items are not complete.",
        incomplete,
        canForce: true,
        message:  "Pass { force: true } to launch anyway.",
      },
      { status: 422 },
    )
  }

  // ── Duplicate-send prevention ──────────────────────────────────────────────
  if (record.invitationSentAt) {
    return NextResponse.json(
      { error: "An invitation has already been sent. Use /resend-invitation to resend it." },
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

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const inviteToken = randomUUID()
  // 30-day invitation window — matches the email body
  const inviteExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Trial clock starts from the agreed trialStartDate (not "now")
  const trialStart = new Date(record.trialStartDate)
  const trialEnd   = new Date(trialStart.getTime() + TRIAL_DAYS * 86400000)

  const isTestOrg = record.organization.isDemo

  // DB writes are atomic — email is sent after commit
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

    // Activate the org: trialing + trial dates computed from agreed start date.
    // subscriptionStatus="trialing" allows the customer to use Relay once they
    // accept the invitation; trialEndsAt enforces the agreed end date.
    await tx.organization.update({
      where: { id: record.organizationId },
      data: {
        subscriptionStatus: "trialing",
        trialStartDate:     trialStart,
        trialEndsAt:        trialEnd,
        plan:               record.plan,
      },
    })

    // Mark as invitation_sent — NOT live. SA marks live after the customer
    // has set up their account (via PATCH status=live).
    await tx.customerOnboarding.update({
      where: { id },
      data: {
        status:           "invitation_sent",
        invitationSentAt: new Date(),
        invitationToken:  inviteToken,
        updatedAt:        new Date(),
      },
    })
  })

  const inviteUrl = `${appUrl}/invite/${inviteToken}`

  // Email delivery is best-effort. Skip entirely for test (isDemo) orgs so the
  // invitation never reaches an unintended real recipient. The token is stored in
  // the DB and the URL is returned in the response for secure SA access.
  let emailResult: { ok: boolean; error?: string } = { ok: true }
  if (!isTestOrg) {
    emailResult = await sendEmail({
      to:      record.primaryContactEmail,
      subject: `Your Relay account for ${record.organization.name} is ready`,
      html:    whiteGloveInviteEmail({
        name:      record.primaryContactName,
        orgName:   record.organization.name,
        inviteUrl,
        trialDays: TRIAL_DAYS,
      }),
    }).catch(err => {
      console.error("[launch] invitation email failed:", err)
      return { ok: false, error: String(err) }
    })
  }

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
      status:           "invitation_sent",
      trialStartDate:   trialStart.toISOString(),
      trialEndsAt:      trialEnd.toISOString(),
      invitationSentTo: record.primaryContactEmail,
      emailSuppressed:  isTestOrg,
      emailDelivered:   isTestOrg ? false : emailResult.ok,
    },
  })

  return NextResponse.json({
    ok:              true,
    status:          "invitation_sent",
    trialStartDate:  trialStart.toISOString(),
    trialEndsAt:     trialEnd.toISOString(),
    inviteUrl,
    emailSuppressed: isTestOrg,
    emailDelivered:  isTestOrg ? false : emailResult.ok,
    emailError:      isTestOrg ? undefined : (emailResult.ok ? undefined : emailResult.error),
  })
}
