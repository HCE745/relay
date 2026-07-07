import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { htmlToText } from "@/lib/html-to-text"
import { logSAAction } from "@/lib/sa-audit"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET /api/super-admin/crm/emails?demoCallId=xxx&contactEmail=xxx
export async function GET(req: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const demoCallId    = searchParams.get("demoCallId")
  const contactEmail  = searchParams.get("contactEmail")

  if (!demoCallId && !contactEmail) {
    return NextResponse.json({ error: "demoCallId or contactEmail required" }, { status: 400 })
  }

  const emails = await prisma.crmEmail.findMany({
    where: demoCallId
      ? { demoCallId }
      : { contactEmail: { equals: contactEmail!, mode: "insensitive" } },
    orderBy: { sentAt: "asc" },
  })

  return NextResponse.json({ emails })
}

// POST /api/super-admin/crm/emails — send an email
export async function POST(req: NextRequest) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    demoCallId?: string
    to:          string
    cc?:         string
    subject:     string
    bodyHtml:    string
    inReplyTo?:  string
    threadId?:   string
  }

  const { to, cc, subject, bodyHtml, demoCallId, inReplyTo, threadId } = body

  if (!to || !subject || !bodyHtml) {
    return NextResponse.json({ error: "to, subject, and bodyHtml required" }, { status: 400 })
  }

  const bodyText = htmlToText(bodyHtml)

  // Build a unique Message-ID
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@getrelay.software>`

  // Send via Resend
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 })
  }

  const resendPayload: Record<string, unknown> = {
    from:    "Will @ Relay <will@getrelay.software>",
    to:      [to],
    subject,
    html:    bodyHtml,
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
    const err = await sendRes.text()
    return NextResponse.json({ error: `Resend error: ${err}` }, { status: 502 })
  }

  // Determine threadId: use existing or self
  let resolvedThreadId = threadId ?? null
  if (!resolvedThreadId && inReplyTo) {
    const parent = await prisma.crmEmail.findUnique({ where: { messageId: inReplyTo } })
    resolvedThreadId = parent?.threadId ?? parent?.id ?? null
  }

  const email = await prisma.crmEmail.create({
    data: {
      demoCallId:   demoCallId ?? null,
      contactEmail: to,
      direction:    "sent",
      fromAddress:  "will@getrelay.software",
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

  await logSAAction({
    superAdminId:   session.superAdminId!,
    superAdminName: session.name ?? "Super Admin",
    action:         "CREATE_REFERRAL" as never,
    orgId:          "system",
    orgName:        "CRM",
    targetType:     "organization",
    targetId:       email.id,
    targetName:     `Email to ${to}`,
  })

  return NextResponse.json({ email })
}
