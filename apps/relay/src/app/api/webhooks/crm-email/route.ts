import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { htmlToText } from "@/lib/html-to-text"

export const dynamic = "force-dynamic"

// Resend inbound webhook for crm@getrelay.software
export async function POST(req: NextRequest) {
  // Verify inbound secret if configured
  const secret = process.env.RESEND_INBOUND_SECRET
  if (secret) {
    const sig = req.headers.get("svix-signature") ?? req.headers.get("x-resend-signature") ?? ""
    if (!sig.includes(secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const payload = await req.json() as {
    from?:       string
    to?:         string | string[]
    subject?:    string
    html?:       string
    text?:       string
    headers?:    Record<string, string>
    messageId?:  string
    inReplyTo?:  string
  }

  const fromAddress  = payload.from ?? ""
  const toAddress    = Array.isArray(payload.to) ? payload.to[0] : (payload.to ?? "")
  const subject      = payload.subject ?? "(no subject)"
  const bodyHtml     = payload.html ?? `<pre>${payload.text ?? ""}</pre>`
  const bodyText     = payload.text ?? htmlToText(bodyHtml)
  const messageId    = payload.messageId ?? payload.headers?.["message-id"] ?? null
  const inReplyTo    = payload.inReplyTo  ?? payload.headers?.["in-reply-to"]  ?? null
  const sentAt       = new Date()

  // Deduplicate
  if (messageId) {
    const dup = await prisma.crmEmail.findUnique({ where: { messageId } })
    if (dup) return NextResponse.json({ ok: true, status: "duplicate" })
  }

  // Extract contact email (the sender of the inbound email)
  const contactEmail = fromAddress.match(/<(.+)>/)?.[1] ?? fromAddress

  // Find a matching demo call by contact email
  const demoCall = await prisma.demoCall.findFirst({
    where:   { contactEmail: { equals: contactEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  })

  // Resolve threadId from In-Reply-To header
  let threadId: string | null = null
  if (inReplyTo) {
    const cleanId = inReplyTo.replace(/^<|>$/g, "")
    const parent  = await prisma.crmEmail.findUnique({ where: { messageId: cleanId } })
    threadId      = parent?.threadId ?? parent?.id ?? null
  }

  const email = await prisma.crmEmail.create({
    data: {
      demoCallId:   demoCall?.id ?? null,
      contactEmail,
      direction:    "received",
      fromAddress,
      toAddress,
      subject,
      bodyHtml,
      bodyText,
      messageId:    messageId ?? undefined,
      inReplyTo:    inReplyTo ?? null,
      threadId,
      sentAt,
      source:       "inbound_webhook",
    },
  })

  if (!threadId) {
    await prisma.crmEmail.update({ where: { id: email.id }, data: { threadId: email.id } })
  }

  // Log CRM activity if demo call has an org
  if (demoCall?.organizationId) {
    await prisma.crmActivity.create({
      data: {
        organizationId:  demoCall.organizationId,
        eventType:       "email_received",
        description:     `Inbound email from ${contactEmail}: "${subject}"`,
        createdBySAName: "Inbound Email",
        metadata:        { emailId: email.id, subject, from: fromAddress },
      },
    })
  }

  // If no demo call found, create a new Lead record
  if (!demoCall) {
    const displayName = fromAddress.match(/^(.+?)\s*</)?.[1]?.trim() ?? contactEmail
    await prisma.demoCall.create({
      data: {
        contactName:    displayName,
        contactEmail,
        companyName:    "Unknown (inbound email)",
        leadSource:     "Inbound Email",
        callStatus:     "Scheduled",
        createdBySAName: "Inbound Webhook",
        crmEmails:      { connect: { id: email.id } },
      },
    })
  }

  return NextResponse.json({ ok: true, emailId: email.id })
}
