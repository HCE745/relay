import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendViaTitanSmtp } from "@/lib/titan-smtp"
import { decryptField } from "@/lib/crypto-utils"
import { htmlToText } from "@/lib/html-to-text"
import { scheduleNextStep } from "@/lib/crm-sequences"
import { generateFollowUpDraft } from "@/lib/crm-ai"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

type FollowUpAction =
  | "approve_and_send"
  | "snooze"
  | "reschedule"
  | "regenerate_draft"
  | "mark_replied"
  | "mark_not_interested"
  | "pause_sequence"
  | "end_sequence"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body   = await req.json() as {
    action:       FollowUpAction
    snoozeHours?: number
    rescheduleAt?:string
    editedSubject?: string
    editedBodyHtml?:string
  }

  const followUp = await prisma.crmFollowUp.findUnique({
    where:   { id },
    include: {
      enrollment: {
        include: {
          sequence: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
          demoCall: { select: { id: true, contactEmail: true, companyName: true } },
        },
      },
    },
  })
  if (!followUp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const enrollment = followUp.enrollment
  const now        = new Date()

  // Load CRM settings for scheduling
  const crmSettings = await prisma.crmSettings.findFirst() ?? { timezone: "America/New_York", sendingWindowStart: 9, sendingWindowEnd: 16 }

  if (body.action === "approve_and_send") {
    // Idempotency: don't double-send
    if (followUp.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 409 })
    if (enrollment.status !== "active") return NextResponse.json({ error: "Enrollment not active" }, { status: 409 })

    // Stop-condition pre-flight
    const replyCheck = await prisma.crmEmail.findFirst({
      where: {
        contactEmail: enrollment.demoCall.contactEmail,
        direction:    "received",
        sentAt:       { gte: enrollment.enrolledAt },
      },
    })
    if (replyCheck) {
      await prisma.crmEmailSequenceEnrollment.update({
        where: { id: enrollment.id },
        data:  { status: "stopped", stopReason: "reply", stoppedAt: now },
      })
      return NextResponse.json({ error: "Reply already received — sequence stopped" }, { status: 409 })
    }

    const subject  = body.editedSubject   ?? followUp.draftSubject   ?? ""
    const bodyHtml = body.editedBodyHtml  ?? followUp.draftBodyHtml  ?? ""
    const bodyText = htmlToText(bodyHtml)

    if (!subject || !bodyHtml) return NextResponse.json({ error: "Draft has no subject or body" }, { status: 400 })

    // Send via Titan SMTP
    const imapCfg = session.superAdminId
      ? await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId } })
      : null

    const messageId  = `<${Date.now()}.${Math.random().toString(36).slice(2)}@getrelay.software>`
    const toAddress  = enrollment.demoCall.contactEmail
    const fromName   = "Will @ Relay"

    if (imapCfg) {
      let smtpPassword: string
      try { smtpPassword = decryptField(imapCfg.encryptedPassword) }
      catch { return NextResponse.json({ error: "Failed to decrypt SMTP credentials" }, { status: 500 }) }

      await sendViaTitanSmtp(
        { smtpHost: imapCfg.smtpHost, smtpPort: imapCfg.smtpPort, emailAddress: imapCfg.emailAddress, password: smtpPassword, fromName },
        { to: toAddress, subject, bodyHtml, bodyText, messageId },
      )
    } else {
      const RESEND_API_KEY = process.env.RESEND_API_KEY
      if (!RESEND_API_KEY) return NextResponse.json({ error: "No SMTP config" }, { status: 500 })
      const r = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ from: `${fromName} <will@getrelay.software>`, to: [toAddress], subject, html: bodyHtml, text: bodyText, headers: { "Message-ID": messageId } }),
      })
      if (!r.ok) return NextResponse.json({ error: "Resend error" }, { status: 502 })
    }

    // Save CrmEmail record
    const email = await prisma.crmEmail.create({
      data: {
        demoCallId:   enrollment.demoCall.id,
        contactEmail: toAddress,
        direction:    "sent",
        fromAddress:  imapCfg?.emailAddress ?? "will@getrelay.software",
        toAddress,
        subject,
        bodyHtml,
        bodyText,
        messageId,
        sentAt:  now,
        source:  "compose",
        threadId: messageId, // will self-thread unless inReplyTo set
      },
    })
    // Self-thread
    await prisma.crmEmail.update({ where: { id: email.id }, data: { threadId: email.id } })

    // Mark follow-up sent
    await prisma.crmFollowUp.update({
      where: { id },
      data:  { status: "sent", sentAt: now, emailId: email.id, approvedAt: followUp.approvedAt ?? now },
    })

    // Update enrollment
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { currentStep: followUp.stepNumber, lastEmailId: email.id, lastContactAt: now },
    })

    // Schedule next step
    await scheduleNextStep({
      enrollment:        { id: enrollment.id, sequenceId: enrollment.sequenceId, currentStep: followUp.stepNumber },
      completedStep:     followUp.stepNumber,
      crmTimezone:       crmSettings.timezone,
      sendingWindowStart: crmSettings.sendingWindowStart,
      sendingWindowEnd:  crmSettings.sendingWindowEnd,
    })

    // CRM activity
    if (enrollment.demoCall) {
      const call = await prisma.demoCall.findUnique({ where: { id: enrollment.demoCall.id }, select: { organizationId: true } })
      if (call?.organizationId) {
        await prisma.crmActivity.create({
          data: {
            organizationId:  call.organizationId,
            eventType:       "email_sent",
            description:     `Follow-up #${followUp.stepNumber} sent to ${toAddress}: "${subject}"`,
            createdBySAName: session.name ?? "Super Admin",
            metadata:        { emailId: email.id, followUpId: id, stepNumber: followUp.stepNumber },
          },
        }).catch(() => null)
      }
    }

    return NextResponse.json({ ok: true, emailId: email.id })

  } else if (body.action === "snooze") {
    const hours = body.snoozeHours ?? 24
    const newTime = new Date(now.getTime() + hours * 60 * 60 * 1000)
    await prisma.crmFollowUp.update({
      where: { id },
      data:  { snoozedUntil: newTime, scheduledFor: newTime },
    })
    return NextResponse.json({ ok: true })

  } else if (body.action === "reschedule") {
    if (!body.rescheduleAt) return NextResponse.json({ error: "rescheduleAt required" }, { status: 400 })
    const newTime = new Date(body.rescheduleAt)
    await prisma.crmFollowUp.update({
      where: { id },
      data:  { scheduledFor: newTime, snoozedUntil: null },
    })
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { nextFollowUpAt: newTime },
    })
    return NextResponse.json({ ok: true })

  } else if (body.action === "regenerate_draft") {
    // Reset to pending so the cron picks it back up, or regenerate inline
    await prisma.crmFollowUp.update({
      where: { id },
      data:  { status: "pending", draftSubject: null, draftBodyHtml: null, draftBodyText: null, aiGeneratedAt: null },
    })
    // Regenerate immediately
    const draft = await generateFollowUpDraft(id)
    if (draft) {
      await prisma.crmFollowUp.update({
        where: { id },
        data:  {
          status:         "draft_generated",
          draftSubject:   draft.subject,
          draftBodyHtml:  draft.bodyHtml,
          draftBodyText:  draft.bodyText,
          aiGeneratedAt:  now,
        },
      })
    }
    return NextResponse.json({ ok: true })

  } else if (body.action === "mark_replied") {
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: "stopped", stopReason: "reply", stoppedAt: now },
    })
    // Cancel pending follow-ups
    await prisma.crmFollowUp.updateMany({
      where: { enrollmentId: enrollment.id, status: { in: ["pending", "draft_generated", "approved"] } },
      data:  { status: "skipped", errorLog: "Sequence stopped: reply marked" },
    })
    // Update current follow-up if still pending
    if (["pending", "draft_generated", "approved"].includes(followUp.status)) {
      await prisma.crmFollowUp.update({
        where: { id },
        data:  { status: "skipped", errorLog: "Sequence stopped: reply marked" },
      })
    }
    return NextResponse.json({ ok: true })

  } else if (body.action === "mark_not_interested") {
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: "stopped", stopReason: "not_interested", stoppedAt: now },
    })
    await prisma.crmFollowUp.updateMany({
      where: { enrollmentId: enrollment.id, status: { in: ["pending", "draft_generated", "approved"] } },
      data:  { status: "skipped", errorLog: "Sequence stopped: not interested" },
    })
    return NextResponse.json({ ok: true })

  } else if (body.action === "pause_sequence") {
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: "paused" },
    })
    return NextResponse.json({ ok: true })

  } else if (body.action === "end_sequence") {
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: "stopped", stopReason: "manual", stoppedAt: now },
    })
    await prisma.crmFollowUp.updateMany({
      where: { enrollmentId: enrollment.id, status: { in: ["pending", "draft_generated", "approved"] } },
      data:  { status: "skipped", errorLog: "Sequence ended manually" },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
