export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { buildThreadText, buildThreadPdf, buildBulkZip } from "@/lib/email-export"
import type { ExportEmail, ExportLinkClick } from "@/lib/email-export"

type Format = "pdf" | "text" | "zip"

export async function POST(req: NextRequest) {
  try {
    const info = await getSalesSession()
    if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json() as {
      threadId?:   string           // single thread
      threadIds?:  string[]         // bulk threads
      emailIds?:   string[]         // specific email IDs (derives threads)
      format:      Format
      startDate?:  string
      endDate?:    string
    }

    const { format, threadId, threadIds, emailIds, startDate, endDate } = body
    if (!format) return NextResponse.json({ error: "format required" }, { status: 400 })

    // Build date range filter
    const dateFilter = startDate || endDate ? {
      sentAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate   ? { lte: new Date(endDate)   } : {}),
      },
    } : {}

    // Determine scope: single thread, bulk threads, or specific emails
    let targetThreadIds: string[] = []

    if (threadId) {
      targetThreadIds = [threadId]
    } else if (threadIds && threadIds.length > 0) {
      targetThreadIds = threadIds
    } else if (emailIds && emailIds.length > 0) {
      // Look up thread IDs from email IDs
      const emails = await prisma.crmEmail.findMany({
        where: { id: { in: emailIds } },
        select: { id: true, threadId: true },
      })
      const keys = emails.map(e => e.threadId ?? e.id)
      targetThreadIds = [...new Set(keys)]
    } else {
      return NextResponse.json({ error: "threadId, threadIds, or emailIds required" }, { status: 400 })
    }

    // Fetch all emails for target threads (with date filter)
    const allEmails = await prisma.crmEmail.findMany({
      where: {
        AND: [
          {
            OR: targetThreadIds.map(key => ({
              OR: [
                { threadId: key },
                { AND: [{ threadId: null }, { id: key }] },
              ],
            })),
          },
          dateFilter,
          { isDeleted: false },
        ],
      },
      include: {
        demoCall: { select: { id: true, contactName: true, companyName: true } },
        linkClicks: {
          where: { clickCount: { gt: 0 } },
          select: { token: true, destinationUrl: true, clickCount: true, firstClickedAt: true },
        },
      },
      orderBy: { sentAt: "asc" },
    })

    // Sales rep restriction: can only export their own sent emails' threads
    if (!info.isSuperAdmin && !info.isManager) {
      const repEmailAddresses = await prisma.imapConfig.findMany({
        where: { salesUserId: info.salesUserId },
        select: { emailAddress: true },
      })
      const repAddresses = new Set(repEmailAddresses.map(c => c.emailAddress.toLowerCase()))
      // Filter to threads where the rep sent at least one email
      const repThreadIds = new Set(
        allEmails
          .filter(e => e.direction === "sent" && repAddresses.has(e.fromAddress.toLowerCase()))
          .map(e => e.threadId ?? e.id)
      )
      const filteredEmails = allEmails.filter(e => repThreadIds.has(e.threadId ?? e.id))
      if (filteredEmails.length < allEmails.length) {
        // Re-scope to only rep's threads
        const filteredIds = [...repThreadIds]
        targetThreadIds = filteredIds
      }
    }

    // Group into threads
    const threadMap = new Map<string, typeof allEmails>()
    for (const e of allEmails) {
      const key = e.threadId ?? e.id
      if (!threadMap.has(key)) threadMap.set(key, [])
      threadMap.get(key)!.push(e)
    }

    if (threadMap.size === 0) {
      return NextResponse.json({ error: "No emails found" }, { status: 404 })
    }

    const toExportEmail = (e: typeof allEmails[0]): ExportEmail => ({
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
      demoCall:    e.demoCall,
    })

    const toExportClick = (c: { token: string; destinationUrl: string; clickCount: number; firstClickedAt: Date | null }): ExportLinkClick => ({
      token:          c.token,
      destinationUrl: c.destinationUrl,
      clickCount:     c.clickCount,
      firstClickedAt: c.firstClickedAt,
    })

    const dateStr = new Date().toISOString().split("T")[0]!

    // ── Single thread (PDF or Text) ──────────────────────────────────────────────
    if ((threadId || emailIds) && format !== "zip" && threadMap.size === 1) {
      const [, threadEmails] = [...threadMap.entries()][0]!
      const firstDc      = threadEmails.find(e => e.demoCall)?.demoCall
      const companyName  = firstDc?.companyName ?? "Unknown"
      const contactName  = firstDc?.contactName ?? "Unknown"
      const allClicks    = threadEmails.flatMap(e => e.linkClicks).map(toExportClick)
      const exportEmails = threadEmails.map(toExportEmail)
      const meta         = { companyName, contactName }
      const slug         = `${companyName}-${contactName}-${dateStr}`.replace(/[^a-zA-Z0-9-]/g, "_")

      if (format === "pdf") {
        const pdfBuf  = await buildThreadPdf(exportEmails, allClicks, meta)
        return new NextResponse(new Blob([pdfBuf], { type: "application/pdf" }), {
          headers: {
            "Content-Type":        "application/pdf",
            "Content-Disposition": `attachment; filename="${slug}.pdf"`,
          },
        })
      } else {
        const text = buildThreadText(exportEmails, allClicks, meta)
        return new NextResponse(text, {
          headers: {
            "Content-Type":        "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${slug}.txt"`,
          },
        })
      }
    }

    // ── Bulk (ZIP, or multi-thread PDF/text) ─────────────────────────────────────
    if (format === "zip") {
      const threads = [...threadMap.entries()].map(([key, emails]) => {
        const firstDc = emails.find(e => e.demoCall)?.demoCall
        return {
          key,
          emails:     emails.map(toExportEmail),
          linkClicks: emails.flatMap(e => e.linkClicks).map(toExportClick),
          meta:       { companyName: firstDc?.companyName, contactName: firstDc?.contactName },
        }
      })
      const zipBuffer = await buildBulkZip(threads)
      return new NextResponse(new Blob([zipBuffer], { type: "application/zip" }), {
        headers: {
          "Content-Type":        "application/zip",
          "Content-Disposition": `attachment; filename="relay-email-export-${dateStr}.zip"`,
        },
      })
    }

    // Multi-thread PDF
    if (format === "pdf") {
      const allExportEmails: ExportEmail[] = []
      const allExportClicks: ExportLinkClick[] = []
      for (const [, emails] of threadMap.entries()) {
        allExportEmails.push(...emails.map(toExportEmail))
        allExportClicks.push(...emails.flatMap(e => e.linkClicks).map(toExportClick))
      }
      allExportEmails.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
      const pdfBuf  = await buildThreadPdf(allExportEmails, allExportClicks, { companyName: "Multiple", contactName: "Multiple Contacts" })
      return new NextResponse(new Blob([pdfBuf], { type: "application/pdf" }), {
        headers: {
          "Content-Type":        "application/pdf",
          "Content-Disposition": `attachment; filename="relay-emails-${dateStr}.pdf"`,
        },
      })
    }

    // Multi-thread Text
    const allExportEmails: ExportEmail[] = []
    const allExportClicks: ExportLinkClick[] = []
    for (const [, emails] of threadMap.entries()) {
      allExportEmails.push(...emails.map(toExportEmail))
      allExportClicks.push(...emails.flatMap(e => e.linkClicks).map(toExportClick))
    }
    allExportEmails.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    const text = buildThreadText(allExportEmails, allExportClicks, { companyName: "Multiple", contactName: "Multiple Contacts" })
    return new NextResponse(text, {
      headers: {
        "Content-Type":        "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="relay-emails-${dateStr}.txt"`,
      },
    })
  } catch (err) {
    console.error("[sales/emails/export]", err)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
