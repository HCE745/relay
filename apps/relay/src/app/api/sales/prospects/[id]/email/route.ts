import "server-only"
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"
import { sendViaTitanSmtp } from "@/lib/titan-smtp"
import { htmlToText } from "@/lib/html-to-text"
import { getSession } from "@/lib/session"
import { markOutreachDone } from "@/lib/research-progress"
import { appendToSentFolder } from "@/lib/imap-sent"

function plainToHtml(plain: string): string {
  return plain
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n")
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: prospectId } = await params

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: { id: true, companyName: true, currentCrmStatus: true },
  })
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 })

  const body = await req.json() as {
    to: string
    subject: string
    emailBody: string
    contactId?: string | null
  }

  const { to, subject, emailBody, contactId } = body

  if (!to?.trim()) return NextResponse.json({ error: "to is required" }, { status: 400 })
  if (!subject?.trim()) return NextResponse.json({ error: "subject is required" }, { status: 400 })
  if (!emailBody?.trim()) return NextResponse.json({ error: "emailBody is required" }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

  const bodyHtml = plainToHtml(emailBody)
  const bodyText = htmlToText(bodyHtml)
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@getrelay.software>`

  // Get SMTP config for sending — prefer the session user's imap config,
  // fall back to the super admin's, then Resend.
  const session = await getSession()
  let fromAddress = "will@getrelay.software"

  const imapCfg = session?.superAdminId
    ? await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId } })
    : session?.salesUserId
      ? await prisma.imapConfig.findFirst({ where: { salesUserId: session.salesUserId } }).catch(() => null)
      : null

  let sentFolderAttempted = false
  let sentFolderSaved = false
  let sentFolderError: string | null = null

  if (imapCfg) {
    sentFolderAttempted = true
    let smtpPass: string
    try { smtpPass = decryptField(imapCfg.encryptedPassword) }
    catch { return NextResponse.json({ error: "Failed to decrypt SMTP credentials" }, { status: 500 }) }

    const mimeBuffer = await sendViaTitanSmtp(
      {
        smtpHost: imapCfg.smtpHost,
        smtpPort: imapCfg.smtpPort,
        emailAddress: imapCfg.emailAddress,
        password: smtpPass,
        fromName: info.salesUserName,
      },
      { to, subject, bodyHtml, bodyText, messageId },
    )
    fromAddress = imapCfg.emailAddress

    // Append to sender's IMAP Sent folder — non-fatal if it fails
    const appendResult = await appendToSentFolder(
      { host: imapCfg.host, port: imapCfg.port, emailAddress: imapCfg.emailAddress },
      smtpPass,
      mimeBuffer,
    )
    sentFolderSaved = appendResult.ok
    if (!appendResult.ok) {
      sentFolderError = appendResult.error ?? "IMAP append failed"
      console.error(`[email/send] Sent-folder append failed for ${imapCfg.emailAddress}: ${sentFolderError}`)
    }
  } else {
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { error: "No SMTP configuration — add one in Settings → Email Config" },
        { status: 500 }
      )
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${info.salesUserName} @ Relay <will@getrelay.software>`,
        to: [to],
        subject,
        html: bodyHtml,
        text: bodyText,
        headers: { "Message-ID": messageId },
      }),
    })
    if (!r.ok) {
      const err = await r.text()
      return NextResponse.json({ error: `Send failed: ${err}` }, { status: 502 })
    }
  }

  // Log the email in CRM
  const email = await prisma.crmEmail.create({
    data: {
      prospectId,
      contactEmail: to,
      direction: "sent",
      fromAddress,
      toAddress: to,
      subject,
      bodyHtml,
      bodyText,
      messageId,
      sentAt: new Date(),
      source: "prospect_outreach",
      sentBySalesUserId: info.salesUserId !== "sa" ? info.salesUserId : null,
      sentFolderAttempted,
      sentFolderSaved,
      sentFolderError,
    },
  })
  await prisma.crmEmail.update({ where: { id: email.id }, data: { threadId: email.id } })

  // Log activity
  await prisma.salesCrmActivity.create({
    data: {
      prospectId,
      contactId: contactId ?? null,
      salesUserId: info.salesUserId !== "sa" ? info.salesUserId : null,
      activityType: "EMAIL_SENT",
      subject,
    },
  }).catch(() => {})

  // Update prospect status and outreach date
  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      lastOutreachDate: new Date(),
      ...(prospect.currentCrmStatus === "researched" ? { currentCrmStatus: "contacted" } : {}),
    },
  })

  // Mark research results for this prospect as done (server-controlled, after confirmed send)
  await markOutreachDone({
    prospectId,
    salesUserId:  session?.salesUserId ?? null,
    superAdminId: session?.superAdminId ?? null,
  }).catch(() => {}) // Non-fatal — email was sent; progress tracking is best-effort

  return NextResponse.json({ emailId: email.id, prospectId })
}
