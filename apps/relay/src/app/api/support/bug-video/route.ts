import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import * as Sentry from "@sentry/nextjs"

const BUG_EMAIL = process.env.BUG_REPORT_EMAIL ?? "will@getrelay.software"
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

function ticketNumber(): string {
  const d    = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `VID-${date}-${rand}`
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function buildEmail(params: {
  ticketNumber:    string
  submittedByName: string
  submittedByRole: string
  orgName:         string
  orgPlan:         string
  userEmail:       string
  description:     string
  currentPageUrl:  string
  browserInfo:     string
  timestamp:       string
  videoUrl:        string
}): string {
  const section = (title: string, content: string) =>
    `<div style="margin:0 0 20px">
      <h3 style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">${esc(title)}</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;font-size:13px;color:#111;line-height:1.6">${content}</div>
    </div>`

  const row = (k: string, v: string) =>
    `<div style="display:flex;gap:8px;margin-bottom:4px"><span style="color:#6b7280;font-size:12px;min-width:100px">${esc(k)}</span><span style="font-size:12px;color:#111">${v}</span></div>`

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#111">
  <div style="background:#7f1d1d;padding:20px 24px;border-radius:12px 12px 0 0">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h1 style="margin:0;font-size:18px;color:#fff;font-weight:700">Screen Recording Bug Report</h1>
      <span style="font-family:monospace;font-size:13px;color:#fca5a5;font-weight:600">${esc(params.ticketNumber)}</span>
    </div>
    <p style="margin:4px 0 0;font-size:13px;color:#fca5a5">${esc(params.orgName)} · ${esc(params.orgPlan)} · ${esc(params.timestamp)}</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    ${section("Customer Info", `
      ${row("Name", `${esc(params.submittedByName)} (${esc(params.submittedByRole)})`)}
      ${row("Organization", esc(params.orgName))}
      ${row("Plan", esc(params.orgPlan))}
      ${row("Email", `<a href="mailto:${esc(params.userEmail)}">${esc(params.userEmail)}</a>`)}
    `)}
    ${section("What Went Wrong", `<div style="white-space:pre-wrap">${esc(params.description)}</div>`)}
    ${section("Context", `
      ${row("Page", `<a href="${esc(params.currentPageUrl)}">${esc(params.currentPageUrl)}</a>`)}
      ${row("Browser", esc(params.browserInfo))}
      ${row("Timestamp", esc(params.timestamp))}
    `)}
    <div style="margin:0 0 20px">
      <h3 style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">Screen Recording</h3>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px">
        <a href="${esc(params.videoUrl)}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">
          ▶ Watch Recording
        </a>
        <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;word-break:break-all">${esc(params.videoUrl)}</p>
      </div>
    </div>
    <p style="margin:0;font-size:12px;color:#6b7280">View in admin: <a href="${APP_URL}/super-admin/bug-reports">${APP_URL}/super-admin/bug-reports</a></p>
  </div>
</div>`
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const videoFile    = formData.get("video") as File | null
    const description  = (formData.get("description") as string | null)?.trim() ?? ""
    const currentPageUrl = (formData.get("currentPageUrl") as string | null) ?? ""
    const browserInfo  = (formData.get("browserInfo") as string | null) ?? ""
    const timestamp    = (formData.get("timestamp") as string | null) ?? new Date().toISOString()

    if (!videoFile || !description) {
      return NextResponse.json({ error: "Video and description are required" }, { status: 400 })
    }

    const ticket = ticketNumber()

    const blob = await put(`bug-recordings/${ticket}.webm`, videoFile, {
      access:      "private",
      contentType: videoFile.type || "video/webm",
    })

    const org = await prisma.organization.findUnique({
      where:  { id: session.organizationId },
      select: { name: true, plan: true },
    })

    const userRecord = await prisma.user.findUnique({
      where:  { id: session.userId },
      select: { email: true },
    })

    // Store the raw private blob URL in the DB.
    // Access it later via /api/attachments/view?url=<encoded> which proxies private blobs.
    await prisma.bugReport.create({
      data: {
        ticketNumber:     ticket,
        organizationId:   session.organizationId,
        submittedById:    session.userId,
        submittedByName:  session.name,
        submittedByRole:  session.role,
        orgName:          org?.name ?? "Unknown",
        orgPlan:          org?.plan ?? null,
        description,
        expectedBehavior: "See screen recording",
        currentPageUrl,
        browserInfo,
        videoUrl:         blob.url,
        status:           "new",
      },
    })

    // Email link goes through the authenticated proxy so the video is actually watchable.
    // The recipient must be logged in to the app — fine for an internal bug report email.
    const videoViewUrl = `${APP_URL}/api/attachments/view?url=${encodeURIComponent(blob.url)}`

    const emailHtml = buildEmail({
      ticketNumber:    ticket,
      submittedByName: session.name,
      submittedByRole: session.role,
      orgName:         org?.name ?? "Unknown",
      orgPlan:         org?.plan ?? "unknown",
      userEmail:       userRecord?.email ?? session.email ?? "",
      description,
      currentPageUrl,
      browserInfo,
      timestamp,
      videoUrl:        videoViewUrl,
    })

    await sendEmail({
      to:      BUG_EMAIL,
      subject: `[VIDEO BUG] ${ticket} — ${org?.name ?? "Unknown"}: ${description.slice(0, 60)}`,
      html:    emailHtml,
    })

    return NextResponse.json({ ok: true, ticketNumber: ticket })
  } catch (err) {
    Sentry.withScope(scope => {
      scope.setTag("organizationId", session.organizationId)
      Sentry.captureException(err)
    })
    console.error("Bug video upload error:", err)
    return NextResponse.json({ error: "Failed to submit recording. Please try again." }, { status: 500 })
  }
}
