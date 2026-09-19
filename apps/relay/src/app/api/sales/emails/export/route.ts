export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { buildThreadText, buildThreadHtml, buildBulkZip } from "@/lib/email-export"
import type { ExportEmail, ExportLinkClick } from "@/lib/email-export"

type Format = "html" | "text" | "zip"

function binaryResp(buf: Buffer, contentType: string, filename: string): NextResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(buf.byteLength),
    },
  })
}

export async function POST(req: NextRequest) {
  console.log("[export] POST start")
  try {
    const info = await getSalesSession()
    if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json() as {
      threadId?:   string
      threadIds?:  string[]
      emailIds?:   string[]
      format:      Format
      startDate?:  string
      endDate?:    string
    }

    const { format, threadId, threadIds, emailIds, startDate, endDate } = body
    console.log("[export] format=%s threadId=%s threadIds=%j", format, threadId, threadIds)

    if (!format) return NextResponse.json({ error: "format required" }, { status: 400 })

    const dateFilter = startDate || endDate ? {
      sentAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate   ? { lte: new Date(endDate)   } : {}),
      },
    } : {}

    let targetThreadIds: string[] = []

    if (threadId) {
      targetThreadIds = [threadId]
    } else if (threadIds && threadIds.length > 0) {
      targetThreadIds = threadIds
    } else if (emailIds && emailIds.length > 0) {
      const emails = await prisma.crmEmail.findMany({
        where: { id: { in: emailIds } },
        select: { id: true, threadId: true },
      })
      const keys = emails.map(e => e.threadId ?? e.id)
      targetThreadIds = [...new Set(keys)]
    } else {
      return NextResponse.json({ error: "threadId, threadIds, or emailIds required" }, { status: 400 })
    }

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

    console.log("[export] found %d emails", allEmails.length)

    if (!info.isSuperAdmin && !info.isManager) {
      const repConfigs = await prisma.imapConfig.findMany({
        where: { salesUserId: info.salesUserId },
        select: { emailAddress: true },
      })
      const repAddresses = new Set(repConfigs.map(c => c.emailAddress.toLowerCase()))
      const repThreadIds = new Set(
        allEmails
          .filter(e => e.direction === "sent" && repAddresses.has(e.fromAddress.toLowerCase()))
          .map(e => e.threadId ?? e.id)
      )
      if (repThreadIds.size < targetThreadIds.length) {
        targetThreadIds = [...repThreadIds]
      }
    }

    const threadMap = new Map<string, typeof allEmails>()
    for (const e of allEmails) {
      const key = e.threadId ?? e.id
      if (!threadMap.has(key)) threadMap.set(key, [])
      threadMap.get(key)!.push(e)
    }

    if (threadMap.size === 0) {
      return NextResponse.json({ error: "No emails found for the requested thread(s)" }, { status: 404 })
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

    // ── Single thread ──────────────────────────────────────────────────────────
    if ((threadId || emailIds) && format !== "zip" && threadMap.size === 1) {
      const [, threadEmails] = [...threadMap.entries()][0]!
      const firstDc     = threadEmails.find(e => e.demoCall)?.demoCall
      const companyName = firstDc?.companyName ?? "Unknown"
      const contactName = firstDc?.contactName ?? "Unknown"
      const allClicks   = threadEmails.flatMap(e => e.linkClicks).map(toExportClick)
      const exportEmails = threadEmails.map(toExportEmail)
      const meta        = { companyName, contactName }
      const slug        = `${companyName}-${contactName}-${dateStr}`.replace(/[^a-zA-Z0-9-]/g, "_")

      if (format === "html") {
        const html = buildThreadHtml(exportEmails, allClicks, meta)
        const buf  = Buffer.from(html, "utf8")
        return binaryResp(buf, "text/html; charset=utf-8", `${slug}.html`)
      } else {
        const text = buildThreadText(exportEmails, allClicks, meta)
        const buf  = Buffer.from(text, "utf8")
        return binaryResp(buf, "text/plain; charset=utf-8", `${slug}.txt`)
      }
    }

    // ── Bulk ZIP ───────────────────────────────────────────────────────────────
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
      console.log("[export] building ZIP, %d threads", threads.length)
      const zipBuf = await buildBulkZip(threads)
      console.log("[export] ZIP built, size=%d", zipBuf.byteLength)
      return binaryResp(zipBuf, "application/zip", `relay-email-export-${dateStr}.zip`)
    }

    // ── Multi-thread HTML ──────────────────────────────────────────────────────
    if (format === "html") {
      const allExportEmails: ExportEmail[] = []
      const allExportClicks: ExportLinkClick[] = []
      for (const [, emails] of threadMap.entries()) {
        allExportEmails.push(...emails.map(toExportEmail))
        allExportClicks.push(...emails.flatMap(e => e.linkClicks).map(toExportClick))
      }
      allExportEmails.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
      const html = buildThreadHtml(allExportEmails, allExportClicks, { companyName: "Multiple", contactName: "Multiple Contacts" })
      const buf  = Buffer.from(html, "utf8")
      return binaryResp(buf, "text/html; charset=utf-8", `relay-emails-${dateStr}.html`)
    }

    // ── Multi-thread Text ──────────────────────────────────────────────────────
    const allExportEmails: ExportEmail[] = []
    const allExportClicks: ExportLinkClick[] = []
    for (const [, emails] of threadMap.entries()) {
      allExportEmails.push(...emails.map(toExportEmail))
      allExportClicks.push(...emails.flatMap(e => e.linkClicks).map(toExportClick))
    }
    allExportEmails.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    const text = buildThreadText(allExportEmails, allExportClicks, { companyName: "Multiple", contactName: "Multiple Contacts" })
    const buf  = Buffer.from(text, "utf8")
    return binaryResp(buf, "text/plain; charset=utf-8", `relay-emails-${dateStr}.txt`)

  } catch (err) {
    console.error("[export] ERROR:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
