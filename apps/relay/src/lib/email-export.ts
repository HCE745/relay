import JSZip from "jszip"

export interface ExportEmail {
  id:          string
  direction:   "sent" | "received"
  fromAddress: string
  toAddress:   string
  subject:     string
  bodyText:    string
  sentAt:      Date | string
  openCount:   number
  openedAt:    Date | string | null
  stageNumber: number | null
  demoCall:    { contactName: string; companyName: string } | null
}

export interface ExportLinkClick {
  token:          string
  destinationUrl: string
  clickCount:     number
  firstClickedAt: Date | string | null
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    month:  "short",
    day:    "numeric",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function bodyToHtml(text: string): string {
  if (!text?.trim()) return "<em style='color:#999'>No body</em>"
  return escHtml(text)
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
}

// ── HTML export (printable, no library required) ───────────────────────────────

export function buildThreadHtml(
  emails:     ExportEmail[],
  linkClicks: ExportLinkClick[],
  meta?:      { companyName?: string; contactName?: string },
): string {
  const sorted = [...emails].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  )
  const company = meta?.companyName
    ?? sorted.find(e => e.demoCall)?.demoCall?.companyName
    ?? "Unknown Company"
  const contact = meta?.contactName
    ?? sorted.find(e => e.demoCall)?.demoCall?.contactName
    ?? "Unknown Contact"
  const subject = sorted[0]?.subject ?? "(no subject)"
  const clicks  = linkClicks.filter(c => c.clickCount > 0)

  const emailRows = sorted.map(e => {
    const sent    = e.direction === "sent"
    const dirCss  = sent ? "color:#0d6e40" : "color:#1a4ea0"
    const dirLabel = sent ? "Outbound" : "Inbound"
    const openInfo = sent
      ? (e.openedAt
          ? `✓ Opened ${e.openCount}× (first ${formatDate(e.openedAt)})`
          : "Not opened")
      : ""
    const stage = e.stageNumber != null ? `<tr><td>Stage</td><td>S${e.stageNumber}</td></tr>` : ""
    return `
<div class="email">
  <div class="email-dir" style="${dirCss}">${dirLabel}</div>
  <table class="meta">
    <tr><td>From</td><td>${escHtml(e.fromAddress)}</td></tr>
    <tr><td>To</td><td>${escHtml(e.toAddress)}</td></tr>
    <tr><td>Date</td><td>${formatDate(e.sentAt)}</td></tr>
    <tr><td>Subject</td><td>${escHtml(e.subject)}</td></tr>
    ${sent ? `<tr><td>Opens</td><td>${openInfo}</td></tr>` : ""}
    ${stage}
  </table>
  <div class="body">${bodyToHtml(e.bodyText)}</div>
</div>`
  }).join("\n")

  const clickRows = clicks.length === 0 ? "" : `
<section class="clicks">
  <h2>Link Click Events</h2>
  <table class="click-table">
    <thead><tr><th>URL</th><th>Clicks</th><th>First clicked</th></tr></thead>
    <tbody>
      ${clicks.map(c => `
      <tr>
        <td><a href="${escHtml(c.destinationUrl)}">${escHtml(c.destinationUrl)}</a></td>
        <td>${c.clickCount}</td>
        <td>${c.firstClickedAt ? formatDate(c.firstClickedAt) : "—"}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</section>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Email Thread — ${escHtml(company)} / ${escHtml(contact)}</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #222; max-width: 800px; margin: 32px auto; padding: 0 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; color: #0d6e40; }
  .subtitle { color: #666; margin-bottom: 24px; font-size: 12px; }
  .meta-header table { border-collapse: collapse; margin-bottom: 24px; }
  .meta-header td { padding: 3px 16px 3px 0; color: #444; }
  .meta-header td:first-child { font-weight: 600; color: #888; font-size: 11px; text-transform: uppercase; white-space: nowrap; }
  .email { border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
  .email-dir { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 6px 14px; background: #f7f7f7; border-bottom: 1px solid #e0e0e0; }
  table.meta { border-collapse: collapse; width: 100%; padding: 10px 14px; display: table; }
  table.meta td { padding: 2px 12px 2px 14px; vertical-align: top; }
  table.meta td:first-child { font-weight: 600; color: #888; font-size: 11px; text-transform: uppercase; white-space: nowrap; width: 70px; }
  .body { padding: 12px 14px 14px; border-top: 1px solid #eee; line-height: 1.6; }
  .body p { margin: 0 0 .75em; }
  .clicks h2 { font-size: 14px; margin-top: 32px; margin-bottom: 8px; }
  .click-table { border-collapse: collapse; width: 100%; }
  .click-table th, .click-table td { padding: 6px 10px; border: 1px solid #e0e0e0; font-size: 12px; }
  .click-table th { background: #f5f5f5; font-weight: 600; }
  .click-table a { color: #1a4ea0; word-break: break-all; }
  .print-note { background: #fffbe6; border: 1px solid #f0d070; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #664; }
  .print-note strong { color: #443; }
</style>
</head>
<body>
<div class="no-print print-note">
  <strong>Tip:</strong> To save as PDF, use your browser's Print function (Ctrl+P / ⌘+P) and choose "Save as PDF".
</div>
<h1>${escHtml(company)} — ${escHtml(contact)}</h1>
<p class="subtitle">Exported ${formatDate(new Date())} · ${sorted.length} email${sorted.length !== 1 ? "s" : ""}</p>
<div class="meta-header">
  <table>
    <tr><td>Subject</td><td>${escHtml(subject)}</td></tr>
    <tr><td>Company</td><td>${escHtml(company)}</td></tr>
    <tr><td>Contact</td><td>${escHtml(contact)}</td></tr>
  </table>
</div>
${emailRows}
${clickRows}
</body>
</html>`
}

// ── Plain-text export ─────────────────────────────────────────────────────────

export function buildThreadText(
  emails:     ExportEmail[],
  linkClicks: ExportLinkClick[],
  meta?:      { companyName?: string; contactName?: string },
): string {
  const sorted = [...emails].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  )
  const company = meta?.companyName
    ?? sorted.find(e => e.demoCall)?.demoCall?.companyName
    ?? "Unknown Company"
  const contact = meta?.contactName
    ?? sorted.find(e => e.demoCall)?.demoCall?.contactName
    ?? "Unknown Contact"
  const subject = sorted[0]?.subject ?? "(no subject)"
  const lines: string[] = []

  lines.push("═".repeat(70))
  lines.push("EMAIL THREAD EXPORT")
  lines.push(`Exported: ${formatDate(new Date())}`)
  lines.push("═".repeat(70))
  lines.push(`Company:  ${company}`)
  lines.push(`Contact:  ${contact}`)
  lines.push(`Subject:  ${subject}`)
  lines.push(`Emails:   ${emails.length}`)
  lines.push("")

  for (const email of sorted) {
    lines.push("─".repeat(70))
    lines.push(`From:     ${email.fromAddress}`)
    lines.push(`To:       ${email.toAddress}`)
    lines.push(`Date:     ${formatDate(email.sentAt)}`)
    lines.push(`Subject:  ${email.subject}`)
    if (email.direction === "sent") {
      if (email.openedAt) {
        lines.push(`Opened:   Yes (${email.openCount}× — first ${formatDate(email.openedAt)})`)
      } else {
        lines.push(`Opened:   No`)
      }
      if (email.stageNumber != null) {
        lines.push(`Stage:    S${email.stageNumber}`)
      }
    }
    lines.push("")
    lines.push(email.bodyText?.trim() || "(no body)")
    lines.push("")
  }

  const clicks = linkClicks.filter(c => c.clickCount > 0)
  if (clicks.length > 0) {
    lines.push("═".repeat(70))
    lines.push("LINK CLICK EVENTS")
    lines.push("─".repeat(70))
    for (const click of clicks) {
      lines.push(`URL:      ${click.destinationUrl}`)
      lines.push(`Clicks:   ${click.clickCount}`)
      if (click.firstClickedAt) {
        lines.push(`First:    ${formatDate(click.firstClickedAt)}`)
      }
      lines.push("")
    }
  }

  lines.push("═".repeat(70))
  return lines.join("\n")
}

// ── ZIP export (one text file per thread) ─────────────────────────────────────

export async function buildBulkZip(
  threads: Array<{
    key:        string
    emails:     ExportEmail[]
    linkClicks: ExportLinkClick[]
    meta?:      { companyName?: string; contactName?: string }
  }>,
): Promise<Buffer> {
  const zip = new JSZip()

  for (const thread of threads) {
    const text    = buildThreadText(thread.emails, thread.linkClicks, thread.meta)
    const company = thread.meta?.companyName
      ?? thread.emails.find(e => e.demoCall)?.demoCall?.companyName
      ?? "thread"
    const contact = thread.meta?.contactName
      ?? thread.emails.find(e => e.demoCall)?.demoCall?.contactName
      ?? thread.key.slice(0, 8)
    const slug    = `${company}-${contact}`.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 40)
    zip.file(`${slug}.txt`, text)
  }

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer
}
