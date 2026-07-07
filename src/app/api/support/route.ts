import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sendEmail } from "@/lib/email"

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? process.env.EMAIL_FROM ?? "support@relay.app"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { subject, message, screenshot, diagnostics } = body

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message required" }, { status: 400 })
  }

  const diagHtml = diagnostics
    ? `
      <table style="border-collapse:collapse;font-size:12px;color:#555;margin-top:16px;width:100%">
        <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap">User</td><td style="padding:4px 8px">${esc(diagnostics.userName)} (${esc(diagnostics.userEmail)})</td></tr>
        <tr style="background:#f9fafb"><td style="padding:4px 8px;font-weight:600">Role</td><td style="padding:4px 8px">${esc(diagnostics.userRole)}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600">Organization</td><td style="padding:4px 8px">${esc(diagnostics.orgName)}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:4px 8px;font-weight:600">Page</td><td style="padding:4px 8px">${esc(diagnostics.page)}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600">Browser</td><td style="padding:4px 8px">${esc(diagnostics.userAgent)}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:4px 8px;font-weight:600">Viewport</td><td style="padding:4px 8px">${esc(diagnostics.viewport)}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600">Timestamp</td><td style="padding:4px 8px">${esc(diagnostics.timestamp)}</td></tr>
        ${diagnostics.recentErrors?.length ? `<tr style="background:#fff5f5"><td style="padding:4px 8px;font-weight:600;color:#b91c1c">Recent Errors</td><td style="padding:4px 8px;color:#b91c1c">${diagnostics.recentErrors.map(esc).join("<br>")}</td></tr>` : ""}
      </table>`
    : ""

  const screenshotHtml = screenshot
    ? `<div style="margin-top:20px"><p style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">Screenshot</p><img src="${screenshot}" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px" /></div>`
    : ""

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#111">
      <div style="background:#2563eb;padding:20px 24px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:18px;color:#fff">Support Request</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:16px">${esc(subject)}</h2>
        <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:14px;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>
        <h3 style="font-size:13px;font-weight:600;color:#6b7280;margin:20px 0 4px;text-transform:uppercase;letter-spacing:.05em">Diagnostics</h3>
        ${diagHtml}
        ${screenshotHtml}
      </div>
    </div>
  `

  const result = await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Support] ${subject.trim().slice(0, 100)} — ${diagnostics?.orgName ?? "Unknown org"}`,
    html,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
