export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { buildThreadText, buildThreadPdf } from "@/lib/email-export"
import type { ExportEmail, ExportLinkClick } from "@/lib/email-export"

export async function POST(req: NextRequest) {
  try {
    const info = await getSalesSession()
    if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json() as {
      accountId:   string
      accountType: "demoCall" | "prospect"
      format:      "pdf" | "text"
    }

    const { accountId, accountType, format } = body
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
      // prospect
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

    const meta       = { companyName, contactName }
    const dateStr    = new Date().toISOString().split("T")[0]!
    const slug       = `${companyName}-${contactName}-${dateStr}`.replace(/[^a-zA-Z0-9-]/g, "_")

    if (format === "pdf") {
      const pdfBuf  = await buildThreadPdf(exportEmails, exportClicks, meta)
      return new NextResponse(new Blob([pdfBuf], { type: "application/pdf" }), {
        headers: {
          "Content-Type":        "application/pdf",
          "Content-Disposition": `attachment; filename="${slug}.pdf"`,
        },
      })
    } else {
      const text = buildThreadText(exportEmails, exportClicks, meta)
      return new NextResponse(text, {
        headers: {
          "Content-Type":        "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slug}.txt"`,
        },
      })
    }
  } catch (err) {
    console.error("[sales/emails/export/account]", err)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
