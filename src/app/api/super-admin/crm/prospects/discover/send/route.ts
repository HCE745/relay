import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"
import { sendViaTitanSmtp } from "@/lib/titan-smtp"
import { htmlToText } from "@/lib/html-to-text"
import { enrollInSequence, getDefaultSequence } from "@/lib/crm-sequences"
import type { DiscoveredCompany } from "../route"

function bodyToHtml(plain: string): string {
  return plain
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n")
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as {
    company: DiscoveredCompany
    to:      string
    subject: string
    emailBody: string
  }

  const { company, to, subject, emailBody } = body
  if (!company?.companyName || !to || !subject || !emailBody) {
    return NextResponse.json({ error: "company, to, subject, and emailBody are required" }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

  // ── Duplicate checks ────────────────────────────────────────────────────────
  // 1. Does this company name already exist as a Prospect?
  const existingProspect = await prisma.prospect.findFirst({
    where: { companyName: { equals: company.companyName, mode: "insensitive" } },
    select: { id: true, companyName: true },
  })

  // 2. Has this email address already been contacted via CRM?
  const existingEmailContact = await prisma.crmEmail.findFirst({
    where: { contactEmail: { equals: to, mode: "insensitive" }, direction: "sent" },
    select: { id: true, demoCall: { select: { id: true, companyName: true } } },
    orderBy: { sentAt: "desc" },
  })

  // Return duplicate info but let the client decide whether to proceed
  if (existingProspect || existingEmailContact) {
    return NextResponse.json({
      duplicate: true,
      prospectId:    existingProspect?.id ?? null,
      demoCallId:    existingEmailContact?.demoCall?.id ?? null,
      companyName:   existingProspect?.companyName ?? existingEmailContact?.demoCall?.companyName ?? null,
    }, { status: 409 })
  }

  // ── Create Prospect record ──────────────────────────────────────────────────
  const prospect = await prisma.prospect.create({
    data: {
      companyName:           company.companyName,
      website:               company.website || null,
      industry:              company.industry || null,
      headquartersCity:      company.city || null,
      headquartersState:     company.state || null,
      source:                "ai_research",
      researchSummary:       company.summary || null,
      operationalPainPoints: company.painPoints?.join(" • ") || null,
      relayFitReasons:       company.relayFitReasons?.join(" • ") || null,
      suggestedOutreachAngle:company.suggestedOutreachAngle || null,
      aiFitScore:            company.fitScore || null,
      currentCrmStatus:      "contacted",
    },
  })

  // ── Create DemoCall record ──────────────────────────────────────────────────
  const demoCall = await prisma.demoCall.create({
    data: {
      contactName:    `${company.companyName} Outreach`,
      contactEmail:   to,
      companyName:    company.companyName,
      industry:       company.industry || null,
      leadSource:     "cold_outreach",
      callStatus:     "Pending",
      painPoints:     company.painPoints?.join("; ") || null,
      createdBySAName: session.name ?? "Super Admin",
    },
  })

  // ── Send email ──────────────────────────────────────────────────────────────
  const bodyHtml = bodyToHtml(emailBody)
  const bodyText = htmlToText(bodyHtml)
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@getrelay.software>`

  const imapCfg = session.superAdminId
    ? await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId } })
    : null

  if (imapCfg) {
    let smtpPass: string
    try { smtpPass = decryptField(imapCfg.encryptedPassword) }
    catch { return NextResponse.json({ error: "Failed to decrypt SMTP credentials" }, { status: 500 }) }
    await sendViaTitanSmtp(
      { smtpHost: imapCfg.smtpHost, smtpPort: imapCfg.smtpPort, emailAddress: imapCfg.emailAddress, password: smtpPass, fromName: "Will @ Relay" },
      { to, subject, bodyHtml, bodyText, messageId },
    )
  } else {
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (!RESEND_API_KEY) return NextResponse.json({ error: "No SMTP configuration — add one in CRM Settings" }, { status: 500 })
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Will @ Relay <will@getrelay.software>", to: [to], subject, html: bodyHtml, text: bodyText, headers: { "Message-ID": messageId } }),
    })
    if (!r.ok) { const err = await r.text(); return NextResponse.json({ error: `Send failed: ${err}` }, { status: 502 }) }
  }

  const fromAddress = imapCfg ? imapCfg.emailAddress : "will@getrelay.software"

  // ── Log email in CRM ────────────────────────────────────────────────────────
  const email = await prisma.crmEmail.create({
    data: {
      demoCallId:   demoCall.id,
      contactEmail: to,
      direction:    "sent",
      fromAddress,
      toAddress:    to,
      subject,
      bodyHtml,
      bodyText,
      messageId,
      sentAt:       new Date(),
      source:       "discover",
    },
  })
  // Set threadId to self (initial outreach)
  await prisma.crmEmail.update({ where: { id: email.id }, data: { threadId: email.id } })

  // ── Enroll in Cold Outreach sequence ───────────────────────────────────────
  try {
    const crmSettings   = await prisma.crmSettings.findFirst()
    const defaultSeq    = await getDefaultSequence()
    if (defaultSeq) {
      await enrollInSequence({
        demoCallId:         demoCall.id,
        sequenceId:         defaultSeq.id,
        initialEmailId:     email.id,
        mode:               "review_before_send",
        crmTimezone:        crmSettings?.timezone           ?? "America/New_York",
        sendingWindowStart: crmSettings?.sendingWindowStart ?? 9,
        sendingWindowEnd:   crmSettings?.sendingWindowEnd   ?? 16,
      })
    }
  } catch (err) {
    console.error("[discover/send] sequence enrollment failed:", err)
    // Non-fatal — email was already sent
  }

  return NextResponse.json({ prospectId: prospect.id, demoCallId: demoCall.id, emailId: email.id })
}
