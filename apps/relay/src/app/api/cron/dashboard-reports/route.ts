import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { MetricsRegistry } from "@/lib/analytics/metrics-engine"
import type { WidgetConfig } from "@/lib/analytics/types"
import type { MetricResult } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const todayHHMM = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`
  const dayOfWeek  = now.getUTCDay()   // 0=Sunday
  const dayOfMonth = now.getUTCDate()  // 1-31

  const reports = await prisma.dashboardReport.findMany({
    where: { isActive: true },
    include: { dashboardLayout: true },
  })

  let sent = 0
  let skipped = 0

  for (const report of reports) {
    try {
      const shouldSend = (() => {
        if (report.frequency === "DAILY") return true
        if (report.frequency === "WEEKLY")  return report.dayOfWeek === dayOfWeek
        if (report.frequency === "MONTHLY") return report.dayOfMonth === dayOfMonth
        return false
      })()

      if (!shouldSend) { skipped++; continue }
      if (report.sendTime !== todayHHMM) { skipped++; continue }

      const recipientIds = report.recipients as string[]
      if (recipientIds.length === 0) { skipped++; continue }

      const recipientUsers = await prisma.user.findMany({
        where: { id: { in: recipientIds }, organizationId: report.organizationId },
        select: { id: true, email: true, name: true },
      })
      if (recipientUsers.length === 0) { skipped++; continue }

      const widgets = report.dashboardLayout.widgets as unknown as WidgetConfig[]
      const now30 = new Date()
      const start = new Date(now30.getTime() - 30 * 86400_000)
      const dateRange = { start, end: now30 }
      const scopeWhere = {}

      const widgetResults: Array<{ widget: WidgetConfig; result: MetricResult | null }> = []
      for (const widget of widgets.slice(0, 12)) {
        const metric = MetricsRegistry.get(widget.metricKey)
        if (!metric) { widgetResults.push({ widget, result: null }); continue }
        try {
          const result = await metric.calculate({
            organizationId: report.organizationId,
            userId:         report.createdById,
            role:           "ADMIN",
            dateRange,
            scopeWhere,
            visualType:     widget.visualType,
            filters:        widget.filters,
          })
          widgetResults.push({ widget, result })
        } catch {
          widgetResults.push({ widget, result: null })
        }
      }

      const html = buildReportEmail(report.name, widgetResults)

      for (const user of recipientUsers) {
        await sendEmail({
          to:      user.email,
          subject: `Dashboard Report: ${report.name}`,
          html,
        })
      }

      await prisma.dashboardReport.update({
        where: { id: report.id },
        data:  { lastSentAt: new Date() },
      })

      sent++
    } catch (err) {
      console.error(`Dashboard report ${report.id} failed:`, err)
    }
  }

  return NextResponse.json({ ok: true, sent, skipped })
}

function buildReportEmail(
  reportName: string,
  widgets: Array<{ widget: WidgetConfig; result: MetricResult | null }>,
): string {
  const FONT   = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  const NAVY   = "#0f172a"
  const BLUE   = "#3b82f6"
  const BORDER = "#e2e8f0"
  const MUTED  = "#64748b"

  const widgetRows = widgets.map(({ widget, result }) => {
    const title = widget.title ?? widget.metricKey
    let valueHtml = `<span style="color:${MUTED}">No data</span>`

    if (result) {
      if (result.type === "scalar") {
        valueHtml = `<strong style="font-size:22px;color:${NAVY}">${result.value.toLocaleString()}${result.unit ? ` ${result.unit}` : ""}</strong>`
      } else if (result.type === "series" && result.data.length > 0) {
        const rows = result.data.slice(0, 5).map(d =>
          `<tr><td style="padding:2px 8px 2px 0;color:${MUTED}">${d.label}</td><td style="padding:2px 0;font-weight:600;color:${NAVY}">${d.value.toLocaleString()}</td></tr>`
        ).join("")
        valueHtml = `<table style="border-collapse:collapse;font-size:12px">${rows}</table>`
      } else if (result.type === "ranked" && result.items.length > 0) {
        const rows = result.items.slice(0, 5).map(item =>
          `<tr><td style="padding:2px 8px 2px 0;color:${MUTED}">${item.rank}. ${item.label}</td><td style="padding:2px 0;font-weight:600;color:${NAVY}">${item.value.toLocaleString()}</td></tr>`
        ).join("")
        valueHtml = `<table style="border-collapse:collapse;font-size:12px">${rows}</table>`
      }
    }

    return `
      <div style="border:1px solid ${BORDER};border-radius:8px;padding:16px;margin-bottom:12px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:.04em">${title}</p>
        ${valueHtml}
      </div>`
  }).join("")

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:${FONT}">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER}">
    <div style="background:${BLUE};padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">${reportName}</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px">Relay dashboard report · ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</p>
    </div>
    <div style="padding:24px 32px">${widgetRows}</div>
    <div style="padding:16px 32px;border-top:1px solid ${BORDER};text-align:center">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"}/analytics/dashboard" style="font-size:13px;color:${BLUE}">View full dashboard →</a>
    </div>
  </div>
</body></html>`
}
