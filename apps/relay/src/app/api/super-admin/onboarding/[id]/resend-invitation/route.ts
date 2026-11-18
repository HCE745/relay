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

// ── POST /api/super-admin/onboarding/[id]/resend-invitation ──────────────────
//
// Resends (or issues a fresh) invitation to the primary contact.
// Safe retry path: never creates a duplicate org or re-activates the trial.
//
// Requires status = "invitation_sent" (invitation must have been sent at least
// once via /launch). Does not work for "live" records.
//
// Behaviour:
//   • If the stored invitation is still valid (expiresAt > now): reuses the
//     existing token and re-sends the same email.
//   • If the stored invitation is expired (or missing): creates a new invitation
//     with a fresh token (30-day window), deletes the old one, updates the
//     stored token, and sends the email.
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const record = await prisma.customerOnboarding.findUnique({
    where:   { id },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (record.status !== "invitation_sent") {
    return NextResponse.json(
      { error: `Resend requires status 'invitation_sent' (current: '${record.status}'). Use /launch to send the first invitation.` },
      { status: 400 },
    )
  }

  // Guard: if the contact already has an account, they don't need an invitation
  const existingUser = await prisma.user.findUnique({
    where: { email: record.primaryContactEmail },
  })
  if (existingUser) {
    return NextResponse.json(
      { error: "This contact already has a user account. No invitation needed." },
      { status: 409 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const now    = new Date()

  // Check whether the stored invitation is still valid
  let inviteToken = record.invitationToken
  let freshInvitation = false

  if (inviteToken) {
    const existingInvitation = await prisma.invitation.findUnique({
      where:  { token: inviteToken },
      select: { expiresAt: true, usedAt: true },
    })

    if (!existingInvitation || existingInvitation.usedAt || existingInvitation.expiresAt < now) {
      // Expired, used, or missing — issue a fresh one
      freshInvitation = true
    }
  } else {
    freshInvitation = true
  }

  if (freshInvitation) {
    const newToken    = randomUUID()
    const newExpiry   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      // Expire / remove the old invitation if it exists
      if (inviteToken) {
        await tx.invitation.updateMany({
          where: { token: inviteToken },
          data:  { expiresAt: now }, // expire immediately
        })
      }

      await tx.invitation.create({
        data: {
          organizationId: record.organizationId,
          email:          record.primaryContactEmail,
          token:          newToken,
          role:           "ADMIN",
          invitedById:    null,
          expiresAt:      newExpiry,
        },
      })

      await tx.customerOnboarding.update({
        where: { id },
        data:  {
          invitationToken:  newToken,
          invitationSentAt: now,
          updatedAt:        now,
        },
      })
    })

    inviteToken = newToken
  } else {
    // Just update the sentAt timestamp for the resend record
    await prisma.customerOnboarding.update({
      where: { id },
      data:  { invitationSentAt: now, updatedAt: now },
    })
  }

  const inviteUrl   = `${appUrl}/invite/${inviteToken}`
  const emailResult = await sendEmail({
    to:      record.primaryContactEmail,
    subject: `Your Relay account for ${record.organization.name} is ready`,
    html:    whiteGloveInviteEmail({
      name:      record.primaryContactName,
      orgName:   record.organization.name,
      inviteUrl,
      trialDays: TRIAL_DAYS,
    }),
  }).catch(err => ({ ok: false, error: String(err) }))

  await logSAAction({
    superAdminId:   session.superAdminId!,
    superAdminName: session.name,
    action:         "UPDATE_CUSTOMER_ONBOARDING",
    orgId:          record.organizationId,
    orgName:        record.organization.name,
    targetType:     "organization",
    targetId:       id,
    targetName:     record.organization.name,
    after: {
      action:          "resend_invitation",
      freshInvitation,
      sentTo:          record.primaryContactEmail,
      emailDelivered:  emailResult.ok,
    },
  })

  return NextResponse.json({
    ok:             true,
    freshInvitation,
    emailDelivered: emailResult.ok,
    emailError:     emailResult.ok ? undefined : emailResult.error,
  })
}
