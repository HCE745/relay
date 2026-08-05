import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { htmlToText } from "@/lib/html-to-text"
import { logSAAction } from "@/lib/sa-audit"
import { decryptField } from "@/lib/crypto-utils"
import { sendViaTitanSmtp } from "@/lib/titan-smtp"
import { enrollInSequence, getDefaultSequence } from "@/lib/crm-sequences"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET /api/super-admin/crm/emails
// Query params (mutually exclusive filters):
//   demoCallId=xxx          — emails for a specific demo call
//   contactEmail=xxx        — emails for a contact email
//   direction=received|sent — filter by direction (use with all=true)
//   all=true                — return all emails (SA inbox/sent view)
//   unread=true             — return count of unread received emails
export async function GET(req: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const demoCallId   = searchParams.get("demoCallId")
  const contactEmail = searchParams.get("contactEmail")
  const direction    = searchParams.get("direction") as "sent" | "received" | null
  const all          = searchParams.get("all") === "true"
  const unread       = searchParams.get("unread") === "true"

  // Unread count shortcut
  if (unread) {
    const count = await prisma.crmEmail.count({
      where: { direction: "received", isRead: false },
    })
    return NextResponse.json({ count })
  }

  if (!demoCallId && !contactEmail && !all) {
    return NextResponse.json({ error: "demoCallId, contactEmail, or all=true required" }, { status: 400 })
  }

  // demoCallId queries: include archived (shown with badge in contact timeline), exclude deleted
  // main/all queries: exclude both deleted and archived
  const baseFilter = demoCallId || contactEmail
    ? { isDeleted: false }
    : { isDeleted: false, isArchived: false }

  const where = demoCallId
    ? { demoCallId, ...baseFilter, ...(direction ? { direction } : {}) }
    : contactEmail
    ? { contactEmail: { equals: contactEmail, mode: "insensitive" as const }, ...baseFilter, ...(direction ? { direction } : {}) }
    : direction
    ? { direction, ...baseFilter }
    : baseFilter

  const emails = await prisma.crmEmail.findMany({
    where,
    include: {
      demoCall: { select: { id: true, contactName: true, companyName: true } },
    },
    orderBy: { sentAt: demoCallId || contactEmail ? "asc" : "desc" },
    take:    all ? 500 : undefined,
  })

  return NextResponse.json({ emails })
}

// POST /api/super-admin/crm/emails — send an email
export async function POST(req: NextRequest) {
  try {
    const session = await requireSA()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json() as {
      demoCallId?:    string
      to:             string
      cc?:            string
      subject:        string
      bodyHtml:       string
      inReplyTo?:     string
      threadId?:      string
      sequenceId?:    string | null   // null = no follow-up sequence
      followUpMode?:  string          // "manual" | "review_before_send" | "auto_send"
    }

    const { to, cc, subject, bodyHtml, demoCallId, inReplyTo, threadId, sequenceId, followUpMode } = body

    if (!to || !subject || !bodyHtml) {
      return NextResponse.json({ error: "to, subject, and bodyHtml required" }, { status: 400 })
    }

    const bodyText = htmlToText(bodyHtml)

    // Build a unique Message-ID
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@getrelay.software>`

    // Prefer Titan SMTP if a config is present, else fall back to Resend
    const imapCfg = session.superAdminId
      ? await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId } })
      : null

    // Determine threadId before creating record
    let resolvedThreadId = threadId ?? null
    if (!resolvedThreadId && inReplyTo) {
      const parent = await prisma.crmEmail.findUnique({ where: { messageId: inReplyTo } })
      resolvedThreadId = parent?.threadId ?? parent?.id ?? null
    }

    const fromAddress = imapCfg ? imapCfg.emailAddress : "will@getrelay.software"

    // Create the CrmEmail record first so we have an ID for the tracking pixel
    const email = await prisma.crmEmail.create({
      data: {
        demoCallId:   demoCallId ?? null,
        contactEmail: to,
        direction:    "sent",
        fromAddress,
        toAddress:    to,
        cc:           cc ?? null,
        subject,
        bodyHtml,
        bodyText,
        messageId,
        inReplyTo:    inReplyTo ?? null,
        threadId:     resolvedThreadId,
        sentAt:       new Date(),
        source:       "compose",
      },
    })

    // If no parent, threadId = self
    if (!resolvedThreadId) {
      await prisma.crmEmail.update({ where: { id: email.id }, data: { threadId: email.id } })
    }

    // Append tracking pixel to the sent body (stored body stays clean — pixel is only in transit)
    const trackingPixel = `<img src="https://app.getrelay.software/api/track/open/${email.id}" width="1" height="1" border="0" style="display:none" alt="" />`
    const trackedHtml   = `${bodyHtml}${trackingPixel}`

    // Send the email
    if (imapCfg) {
      let smtpPassword: string
      try {
        smtpPassword = decryptField(imapCfg.encryptedPassword)
      } catch {
        await prisma.crmEmail.delete({ where: { id: email.id } }).catch(() => null)
        return NextResponse.json({ error: "Failed to decrypt SMTP credentials — check IMAP_ENCRYPTION_KEY" }, { status: 500 })
      }
      console.log(`[crm-email] Sending via Titan SMTP (${imapCfg.smtpHost}:${imapCfg.smtpPort})`)
      try {
        await sendViaTitanSmtp(
          {
            smtpHost:     imapCfg.smtpHost,
            smtpPort:     imapCfg.smtpPort,
            emailAddress: imapCfg.emailAddress,
            password:     smtpPassword,
            fromName:     "Will @ Relay",
          },
          { to, cc, subject, bodyHtml: trackedHtml, bodyText, messageId, inReplyTo },
        )
      } catch (sendErr) {
        await prisma.crmEmail.delete({ where: { id: email.id } }).catch(() => null)
        throw sendErr
      }
    } else {
      // Fallback: Resend
      const RESEND_API_KEY = process.env.RESEND_API_KEY
      if (!RESEND_API_KEY) {
        await prisma.crmEmail.delete({ where: { id: email.id } }).catch(() => null)
        console.error("[crm-email] No IMAP config and RESEND_API_KEY not set")
        return NextResponse.json({ error: "No SMTP configuration found — add one in CRM Settings" }, { status: 500 })
      }
      const resendPayload: Record<string, unknown> = {
        from:    "Will @ Relay <will@getrelay.software>",
        to:      [to],
        subject,
        html:    trackedHtml,
        text:    bodyText,
        headers: { "Message-ID": messageId, ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}) },
      }
      if (cc) resendPayload.cc = [cc]
      const sendRes = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body:    JSON.stringify(resendPayload),
      })
      if (!sendRes.ok) {
        await prisma.crmEmail.delete({ where: { id: email.id } }).catch(() => null)
        const err = await sendRes.text()
        console.error("[crm-email] Resend rejected:", sendRes.status, err)
        return NextResponse.json({ error: `Resend error: ${err}` }, { status: 502 })
      }
    }

    // Assign follow-up stage and calculate next followUpDate
    try {
      const allStages = await prisma.followUpStage.findMany({ orderBy: { stageNumber: "asc" } })
      if (allStages.length > 0) {
        const prevSent = await prisma.crmEmail.findFirst({
          where: {
            direction: "sent",
            isDeleted:  false,
            id:         { not: email.id },
            ...(demoCallId
              ? { demoCallId }
              : { contactEmail: { equals: to, mode: "insensitive" as const } }),
          },
          orderBy: { sentAt: "desc" },
          select:  { stageNumber: true },
        })
        const thisStageNum   = (prevSent?.stageNumber ?? -1) + 1
        const nextStage      = allStages.find(s => s.stageNumber === thisStageNum + 1)
        const followUpDateCalc = nextStage
          ? new Date(Date.now() + nextStage.daysAfterPrevious * 24 * 60 * 60 * 1000)
          : null
        await prisma.crmEmail.update({
          where: { id: email.id },
          data:  { stageNumber: thisStageNum, followUpDate: followUpDateCalc },
        })
      }
    } catch (stageErr) {
      console.error("[crm-email] stage assignment failed:", stageErr)
    }

    // Log CRM activity if demoCallId has an org
    if (demoCallId) {
      const call = await prisma.demoCall.findUnique({ where: { id: demoCallId }, select: { organizationId: true } })
      if (call?.organizationId) {
        await prisma.crmActivity.create({
          data: {
            organizationId: call.organizationId,
            eventType:      "email_sent",
            description:    `Email sent to ${to}: "${subject}"`,
            createdBySAName: session.name ?? "Super Admin",
            metadata:        { emailId: email.id, subject, to },
          },
        })
      }
    }

    // Enroll in sequence if requested (and this is an initial outreach, not a reply)
    if (demoCallId && sequenceId !== null && !inReplyTo) {
      const crmSettings = await prisma.crmSettings.findFirst()
      const resolvedSeqId = sequenceId ?? (await getDefaultSequence())?.id
      if (resolvedSeqId) {
        await enrollInSequence({
          demoCallId,
          sequenceId:         resolvedSeqId,
          initialEmailId:     email.id,
          mode:               followUpMode ?? "review_before_send",
          crmTimezone:        crmSettings?.timezone           ?? "America/New_York",
          sendingWindowStart: crmSettings?.sendingWindowStart ?? 9,
          sendingWindowEnd:   crmSettings?.sendingWindowEnd   ?? 16,
        }).catch(err => console.error("[crm-email] enrollment failed:", err))
      }
    }

    // Audit log — fire-and-forget so a failure never blocks the response
    if (session.superAdminId) {
      logSAAction({
        superAdminId:   session.superAdminId,
        superAdminName: session.name ?? "Super Admin",
        action:         "SEND_CRM_EMAIL",
        orgId:          "system",
        orgName:        "CRM",
        targetType:     "organization",
        targetId:       email.id,
        targetName:     `Email to ${to}`,
      }).catch(err => console.error("[crm-email] audit log failed:", err))
    }

    return NextResponse.json({ email })
  } catch (err) {
    console.error("[crm-email] POST error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
