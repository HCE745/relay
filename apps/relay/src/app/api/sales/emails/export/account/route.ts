export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { buildThreadText, buildThreadPdf } from "@/lib/email-export"
import type { ExportEmail, ExportLinkClick } from "@/lib/email-export"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function binaryResp(buf: Buffer, contentType: string, filename: string): NextResponse {
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buf.byteLength),
    },
  })
}

export async function POST(req: NextRequest) {
  console.log("[export/account] POST start")
  try {
    const info = await getSalesSession()
    if (!info) {
      console.log("[export/account] unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json() as {
      accountId:   string
      accountType: "demoCall" | "prospect"
      format:      "pdf" | "text"
    }

    const { accountId, accountType, format } = body
    console.log("[export/account] accountId=%s accountType=%s format=%s", accountId, accountType, format)

    if (!accountId || !accountType || !format) {
      return NextResponse.json({ error: "accountId, accountType, and format required" }, { status: 400 })
    }

    let companyName = "Unknown"
    let contactName = "Unknown"
    type EmailWithIncludes = {
      id: string; direction: string; fromAddress: string; toAddress: string
      subject: string; bodyText: string | null; sentAt: Date; openCount: number
      openedAt: Date | null; stageNumber: number | null
      linkClicks: { token: string; destinationUrl: string; clickCount: number; firstClickedAt: Date | null }[]
    }
    let emails: EmailWithIncludes[] = []

    if (accountType === "demoCall") {
      const call = await prisma.demoCall.findUnique({
        where:   { id: accountId },
        select:  { id: true, contactName: true, companyName: true },
      })
      if (!call) return NextResponse.json({ error: "DemoCall not found" }, { status: 404 })

      companyName = call.companyName
      contactName = call.contactName

      emails = await prisma.crmEmail.findMany({
        where: { demoCallId: accountId, isDeleted: false },
        include: {
          linkClicks: {
            where:  { clickCount: { gt: 0 } },
            select: { token: true, destinationUrl: true, clickCount: true, firstClickedAt: true },
          },
        },
        orderBy: { sentAt: "asc" },
      })
    } else {
      const prospect = await prisma.prospect.findUnique({
        where:   { id: accountId },
        include: { contacts: { select: { email: true } } },
      })
      if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 })

      companyName = prospect.companyName
      contactName = prospect.contacts.find(c => c.email)?.email ?? "Unknown"

      const contactEmails = prospect.contacts.map(c => c.email).filter(Boolean) as string[]
      if (contactEmails.length === 0) {
        return NextResponse.json({ error: "No contact emails for this prospect" }, { status: 404 })
      }

      emails = await prisma.crmEmail.findMany({
        where: {
          OR: [
            { toAddress:   { in: contactEmails } },
            { fromAddress: { in: contactEmails } },
          ],
          isDeleted: false,
        },
        include: {
          linkClicks: {
            where:  { clickCount: { gt: 0 } },
            select: { token: true, destinationUrl: true, clickCount: true, firstClickedAt: true },
          },
        },
        orderBy: { sentAt: "asc" },
      })
    }

    console.log("[export/account] found %d emails", emails.length)

    if (emails.length === 0) {
      return NextResponse.json({ error: "No emails found for this account" }, { status: 404 })
    }

    const exportEmails: ExportEmail[] = emails.map(e => ({
      id:          e.id,
      direction:   e.direction as "sent" | "received",
      fromAddress: e.fromAddress,
      toAddress:   e.toAddress,
      subject:     e.subject,
      bodyText:    e.bodyText ?? "",
      sentAt:      e.sentAt,
      openCount:   e.openCount,
      openedAt:    e.openedAt,
      stageNumber: e.stageNumber,
      demoCall:    accountType === "demoCall"
        ? { contactName, companyName }
        : null,
    }))

    const exportClicks: ExportLinkClick[] = emails.flatMap(e =>
      e.linkClicks.map(c => ({
        token:          c.token,
        destinationUrl: c.destinationUrl,
        clickCount:     c.clickCount,
        firstClickedAt: c.firstClickedAt,
      }))
    )

    const meta    = { companyName, contactName }
    const dateStr = new Date().toISOString().split("T")[0]!
    const slug    = `${companyName}-${contactName}-${dateStr}`.replace(/[^a-zA-Z0-9-]/g, "_")

    if (format === "pdf") {
      console.log("[export/account] building PDF, %d emails", exportEmails.length)
      const pdfBuf = await buildThreadPdf(exportEmails, exportClicks, meta)
      console.log("[export/account] PDF built, size=%d", pdfBuf.byteLength)
      return binaryResp(pdfBuf, "application/pdf", `${slug}.pdf`)
    } else {
      const text = buildThreadText(exportEmails, exportClicks, meta)
      const buf  = Buffer.from(text, "utf8")
      return binaryResp(buf, "text/plain; charset=utf-8", `${slug}.txt`)
    }
  } catch (err) {
    console.error("[export/account] ERROR:", err)
    return NextResponse.json({ error: "Export failed", detail: String(err) }, { status: 500 })
  }
}
