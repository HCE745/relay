import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import * as Sentry from "@sentry/nextjs"

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const SENTRY_ORG        = process.env.SENTRY_ORG ?? "relay-wv"
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN
const BUG_EMAIL         = process.env.BUG_REPORT_EMAIL ?? "will@getrelay.software"
const APP_URL           = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

function ticketNumber(): string {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `BUG-${date}-${rand}`
}

interface SentryIssue {
  id:       string
  title:    string
  count:    string
  lastSeen: string
}

async function querySentryErrors(orgId: string): Promise<SentryIssue[]> {
  if (!SENTRY_AUTH_TOKEN) return []
  try {
    const url = new URL(`https://sentry.io/api/0/organizations/${SENTRY_ORG}/issues/`)
    url.searchParams.set("query", `tags[organizationId]:${orgId} is:unresolved`)
    url.searchParams.set("statsPeriod", "24h")
    url.searchParams.set("limit", "5")
    url.searchParams.set("sort", "date")

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json() as SentryIssue[]
    return Array.isArray(data)
      ? data.map(i => ({ id: i.id, title: i.title, count: i.count, lastSeen: i.lastSeen }))
      : []
  } catch {
    return []
  }
}

interface AIDiagnosis {
  diagnosis:    string
  suggestedFix: string
  severity:     "low" | "medium" | "high" | "critical"
}

async function getAIDiagnosis(params: {
  description:      string
  expectedBehavior: string
  currentPageUrl:   string
  browserInfo:      string
  sentryErrors:     SentryIssue[]
}): Promise<AIDiagnosis | null> {
  if (!ANTHROPIC_API_KEY) return null
  try {
    const sentrySection = params.sentryErrors.length > 0
      ? params.sentryErrors.map(e => `- ${e.title} (${e.count} occurrences, last: ${e.lastSeen})`).join("\n")
      : "No Sentry errors matched."

    const prompt = `You are a technical support specialist for Relay, a facility management SaaS.

A user submitted this bug report. Analyze it and respond with ONLY valid JSON.

Bug description: ${params.description}
Expected behavior: ${params.expectedBehavior}
Page: ${params.currentPageUrl}
Browser: ${params.browserInfo}
Sentry errors (last 24h for this org):
${sentrySection}

Respond with exactly this JSON structure:
{
  "diagnosis": "1-2 sentence likely cause",
  "suggestedFix": "1-3 sentence suggested fix or next debugging steps",
  "severity": "low|medium|high|critical"
}

Severity guide: critical=data loss/login broken, high=major feature broken, medium=feature degraded, low=cosmetic/minor.`

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages:   [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) return null
    const data = await res.json() as { content?: { text?: string }[] }
    const text = data.content?.[0]?.text ?? ""
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as AIDiagnosis
  } catch {
    return null
  }
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "background:#dc2626;color:#fff",
    high:     "background:#ea580c;color:#fff",
    medium:   "background:#d97706;color:#fff",
    low:      "background:#16a34a;color:#fff",
  }
  const style = colors[severity] ?? colors.low
  return `<span style="${style};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase">${esc(severity)}</span>`
}

function buildEmail(params: {
  ticketNumber:     string
  submittedByName:  string
  submittedByRole:  string
  orgName:          string
  orgPlan:          string
  userEmail:        string
  description:      string
  expectedBehavior: string
  currentPageUrl:   string
  browserInfo:      string
  timestamp:        string
  sentryErrors:     SentryIssue[]
  aiDiagnosis:      string
  aiSuggestedFix:   string
  aiSeverity:       string
  screenshotDataUrl: string | null
}): string {
  const section = (title: string, content: string) =>
    `<div style="margin:0 0 20px">
      <h3 style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">${esc(title)}</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;font-size:13px;color:#111;line-height:1.6">${content}</div>
    </div>`

  const row = (k: string, v: string) =>
    `<div style="display:flex;gap:8px;margin-bottom:4px"><span style="color:#6b7280;font-size:12px;min-width:100px">${esc(k)}</span><span style="font-size:12px;color:#111">${v}</span></div>`

  const sentryHtml = params.sentryErrors.length > 0
    ? params.sentryErrors.map(e =>
        `<div style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:12px">
          <span style="font-family:monospace;color:#dc2626">${esc(e.title)}</span>
          <span style="color:#6b7280;margin-left:8px">${esc(e.count)} occurrences · last ${esc(e.lastSeen)}</span>
        </div>`
      ).join("")
    : `<span style="color:#6b7280;font-size:12px">No matching Sentry errors in last 24h</span>`

  const screenshotHtml = params.screenshotDataUrl
    ? `${section("Screenshot", `<img src="${params.screenshotDataUrl}" style="max-width:100%;border-radius:4px;display:block" />`)}`
    : ""

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#111">
  <div style="background:#1e3a5f;padding:20px 24px;border-radius:12px 12px 0 0">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h1 style="margin:0;font-size:18px;color:#fff;font-weight:700">Bug Report</h1>
      <span style="font-family:monospace;font-size:13px;color:#93c5fd;font-weight:600">${esc(params.ticketNumber)}</span>
    </div>
    <p style="margin:4px 0 0;font-size:13px;color:#93c5fd">${esc(params.orgName)} · ${esc(params.orgPlan)} · ${esc(params.timestamp)}</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    ${section("Customer Info", `
      ${row("Name", `${esc(params.submittedByName)} (${esc(params.submittedByRole)})`)}
      ${row("Organization", esc(params.orgName))}
      ${row("Plan", esc(params.orgPlan))}
      ${row("Email", `<a href="mailto:${esc(params.userEmail)}">${esc(params.userEmail)}</a>`)}
    `)}
    ${section("Bug Description", `<div style="white-space:pre-wrap">${esc(params.description)}</div>`)}
    ${section("Expected Behavior", `<div style="white-space:pre-wrap">${esc(params.expectedBehavior)}</div>`)}
    ${section("Auto-Captured Context", `
      ${row("Page", `<a href="${esc(params.currentPageUrl)}">${esc(params.currentPageUrl)}</a>`)}
      ${row("Browser", esc(params.browserInfo))}
      ${row("Timestamp", esc(params.timestamp))}
    `)}
    ${section("Matched Sentry Errors (last 24h)", sentryHtml)}
    <div style="margin:0 0 20px">
      <h3 style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">AI Diagnosis</h3>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <strong style="font-size:13px">Severity:</strong> ${severityBadge(params.aiSeverity)}
        </div>
        <p style="margin:0 0 8px;font-size:13px"><strong>Likely cause:</strong> ${esc(params.aiDiagnosis)}</p>
        <p style="margin:0;font-size:13px"><strong>Suggested fix:</strong> ${esc(params.aiSuggestedFix)}</p>
      </div>
    </div>
    <p style="margin:0;font-size:12px;color:#6b7280">View in admin: <a href="${APP_URL}/super-admin/bug-reports">${APP_URL}/super-admin/bug-reports</a></p>
    ${screenshotHtml}
  </div>
</div>`
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    description:      string
    expectedBehavior: string
    currentPageUrl:   string
    browserInfo:      string
    screenshotDataUrl?: string
    timestamp:        string
  }

  if (!body.description?.trim() || !body.expectedBehavior?.trim()) {
    return NextResponse.json({ error: "Description and expected behavior are required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { name: true, plan: true },
  })

  const ticket = ticketNumber()

  try {
    const [sentryErrors, aiDiagnosis] = await Promise.all([
      querySentryErrors(session.organizationId),
      getAIDiagnosis({
        description:      body.description,
        expectedBehavior: body.expectedBehavior,
        currentPageUrl:   body.currentPageUrl,
        browserInfo:      body.browserInfo,
        sentryErrors:     [],
      }),
    ])

    // Re-run AI with Sentry context if errors were found
    const finalAI = sentryErrors.length > 0
      ? await getAIDiagnosis({
          description:      body.description,
          expectedBehavior: body.expectedBehavior,
          currentPageUrl:   body.currentPageUrl,
          browserInfo:      body.browserInfo,
          sentryErrors,
        }) ?? aiDiagnosis
      : aiDiagnosis

    await prisma.bugReport.create({
      data: {
        ticketNumber:     ticket,
        organizationId:   session.organizationId,
        submittedById:    session.userId,
        submittedByName:  session.name,
        submittedByRole:  session.role,
        orgName:          org?.name ?? "Unknown",
        orgPlan:          org?.plan ?? null,
        description:      body.description.trim(),
        expectedBehavior: body.expectedBehavior.trim(),
        currentPageUrl:   body.currentPageUrl,
        browserInfo:      body.browserInfo,
        screenshotDataUrl: body.screenshotDataUrl ?? null,
        sentryErrors:     sentryErrors.length > 0 ? JSON.parse(JSON.stringify(sentryErrors)) : undefined,
        aiDiagnosis:      finalAI?.diagnosis    ?? null,
        aiSuggestedFix:   finalAI?.suggestedFix ?? null,
        aiSeverity:       finalAI?.severity     ?? null,
        status:           "new",
      },
    })

    const userRecord = await prisma.user.findUnique({
      where:  { id: session.userId },
      select: { email: true },
    })

    const emailHtml = buildEmail({
      ticketNumber:     ticket,
      submittedByName:  session.name,
      submittedByRole:  session.role,
      orgName:          org?.name ?? "Unknown",
      orgPlan:          org?.plan ?? "unknown",
      userEmail:        userRecord?.email ?? session.email ?? "",
      description:      body.description.trim(),
      expectedBehavior: body.expectedBehavior.trim(),
      currentPageUrl:   body.currentPageUrl,
      browserInfo:      body.browserInfo,
      timestamp:        body.timestamp,
      sentryErrors,
      aiDiagnosis:      finalAI?.diagnosis    ?? "AI diagnosis unavailable",
      aiSuggestedFix:   finalAI?.suggestedFix ?? "N/A",
      aiSeverity:       finalAI?.severity     ?? "medium",
      screenshotDataUrl: body.screenshotDataUrl ?? null,
    })

    await sendEmail({
      to:      BUG_EMAIL,
      subject: `[${finalAI?.severity?.toUpperCase() ?? "BUG"}] ${ticket} — ${org?.name ?? "Unknown"}: ${body.description.slice(0, 60)}`,
      html:    emailHtml,
    })

    return NextResponse.json({ ok: true, ticketNumber: ticket })
  } catch (err) {
    Sentry.withScope(scope => {
      scope.setTag("organizationId", session.organizationId)
      Sentry.captureException(err)
    })
    console.error("Bug report error:", err)
    return NextResponse.json({ error: "Failed to submit bug report. Please try again." }, { status: 500 })
  }
}
