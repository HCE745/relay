export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { htmlToText } from "@/lib/html-to-text"
import { decryptField } from "@/lib/crypto-utils"
import { sendViaTitanSmtp } from "@/lib/titan-smtp"

export async function POST(req: NextRequest) {
  try {
    const info = await getSalesSession()
    if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json() as {
      demoCallId?:  string
      to:           string
      cc?:          string
      subject:      string
      bodyHtml:     string
      inReplyTo?:   string
      threadId?:    string
    }

    const { to, cc, subject, bodyHtml, demoCallId, inReplyTo, threadId } = body
    if (!to || !subject || !bodyHtml) {
      return NextResponse.json({ error: "to, subject, and bodyHtml required" }, { status: 400 })
    }

    // Find rep's IMAP config, fall back to SA's
    const repConfig = info.isSuperAdmin ? null : await prisma.imapConfig.findUnique({
      where: { salesUserId: info.salesUserId },
    })
    const saConfig = repConfig ? null : await prisma.imapConfig.findFirst({
      where: { superAdminId: { not: null } },
    })
    const imapCfg = repConfig ?? saConfig

    const bodyText  = htmlToText(bodyHtml)
    const messageId = `<${Date.now()}.${randomBytes(6).toString("hex")}@getrelay.software>`

    let resolvedThreadId = threadId ?? null
    if (!resolvedThreadId && inReplyTo) {
      const parent = await prisma.crmEmail.findUnique({ where: { messageId: inReplyTo } })
      resolvedThreadId = parent?.threadId ?? parent?.id ?? null
    }

    const fromAddress = imapCfg?.emailAddress ?? "will@getrelay.software"

    const email = await prisma.crmEmail.create({
      data: {
        demoCallId:         demoCallId ?? null,
        contactEmail:       to,
        direction:          "sent",
        fromAddress,
        toAddress:          to,
        cc:                 cc ?? null,
        subject,
        bodyHtml,
        bodyText,
        messageId,
        inReplyTo:          inReplyTo ?? null,
        threadId:           resolvedThreadId,
        sentAt:             new Date(),
        source:             "compose",
        sentBySalesUserId:  info.isSuperAdmin ? null : info.salesUserId,
        imapConfigId:       imapCfg?.id ?? null,
      },
    })

    if (!resolvedThreadId) {
      await prisma.crmEmail.update({ where: { id: email.id }, data: { threadId: email.id } })
    }

    // Link tracking pixel
    const trackingPixel = `<img src="https://app.getrelay.software/api/track/open/${email.id}" width="1" height="1" border="0" style="display:none" alt="" />`
    let processedHtml = bodyHtml
    try {
      const trackSetting = await prisma.salesSetting.findUnique({ where: { key: "link_tracking_enabled" } })
      if (trackSetting?.value !== "false") {
        const urlPattern = /href="(https?:\/\/[^"]+)"/gi
        const tokenMap = new Map<string, string>()
        for (const [, url] of bodyHtml.matchAll(urlPattern)) {
          if (!url.includes("app.getrelay.software") && !tokenMap.has(url)) {
            tokenMap.set(url, randomBytes(9).toString("base64url").slice(0, 12))
          }
        }
        if (tokenMap.size > 0) {
          const contact = await prisma.prospectContact.findFirst({
            where: { email: { equals: to, mode: "insensitive" } },
            select: { prospectId: true },
          })
          await Promise.all([...tokenMap.entries()].map(([destinationUrl, token]) =>
            prisma.linkClick.create({
              data: { token, crmEmailId: email.id, prospectId: contact?.prospectId ?? null, destinationUrl, emailSentAt: new Date() },
            })
          ))
          processedHtml = bodyHtml.replace(urlPattern, (_full, url) => {
            const token = tokenMap.get(url)
            return token ? `href="https://app.getrelay.software/t/${token}"` : _full
          })
        }
      }
    } catch {}

    const trackedHtml = `${processedHtml}${trackingPixel}`

    if (imapCfg) {
      let smtpPassword: string
      try {
        smtpPassword = decryptField(imapCfg.encryptedPassword)
      } catch {
        await prisma.crmEmail.delete({ where: { id: email.id } }).catch(() => null)
        return NextResponse.json({ error: "Failed to decrypt SMTP credentials" }, { status: 500 })
      }
      try {
        await sendViaTitanSmtp(
          { smtpHost: imapCfg.smtpHost, smtpPort: imapCfg.smtpPort, emailAddress: imapCfg.emailAddress, password: smtpPassword },
          { to, cc, subject, bodyHtml: trackedHtml, bodyText, messageId, inReplyTo },
        )
      } catch (sendErr) {
        await prisma.crmEmail.delete({ where: { id: email.id } }).catch(() => null)
        throw sendErr
      }
    } else {
      await prisma.crmEmail.delete({ where: { id: email.id } }).catch(() => null)
      return NextResponse.json({ error: "No SMTP configuration found — configure IMAP in Email Settings" }, { status: 500 })
    }

    // Follow-up stage assignment
    try {
      const allStages = await prisma.followUpStage.findMany({ orderBy: { stageNumber: "asc" } })
      if (allStages.length > 0) {
        const previousSentCount = await prisma.crmEmail.count({
          where: {
            direction: "sent",
            isDeleted:  false,
            id:         { not: email.id },
            ...(demoCallId ? { demoCallId } : { contactEmail: { equals: to, mode: "insensitive" as const } }),
          },
        })
        const nextStage       = allStages.find(s => s.stageNumber === previousSentCount + 1)
        const followUpDate    = nextStage ? new Date(Date.now() + nextStage.daysAfterPrevious * 24 * 60 * 60 * 1000) : null
        await prisma.crmEmail.update({ where: { id: email.id }, data: { stageNumber: previousSentCount, followUpDate } })
      }
    } catch {}

    return NextResponse.json({ ok: true, emailId: email.id })
  } catch (err) {
    console.error("[sales/emails] send failed:", err)
    return NextResponse.json({ error: "Send failed" }, { status: 500 })
  }
}
