import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib"
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

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

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
  lines.push(`EMAIL THREAD EXPORT`)
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
    const body = email.bodyText?.trim() ? email.bodyText : stripHtml("")
    lines.push(body || "(no body)")
    lines.push("")
  }

  if (linkClicks.length > 0) {
    lines.push("═".repeat(70))
    lines.push("LINK CLICK EVENTS")
    lines.push("─".repeat(70))
    for (const click of linkClicks) {
      if (click.clickCount === 0) continue
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

export async function buildThreadPdf(
  emails:     ExportEmail[],
  linkClicks: ExportLinkClick[],
  meta?:      { companyName?: string; contactName?: string },
): Promise<ArrayBuffer> {
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

  const doc   = await PDFDocument.create()
  const font  = await doc.embedFont(StandardFonts.Helvetica)
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageW = PageSizes.Letter[0]
  const pageH = PageSizes.Letter[1]
  const margin   = 50
  const colW     = pageW - margin * 2
  const lineH    = 14
  const fontSize = 10
  const titleSz  = 14
  const headSz   = 11

  let page  = doc.addPage(PageSizes.Letter)
  let y     = pageH - margin

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage(PageSizes.Letter)
      y = pageH - margin
    }
  }

  function drawText(text: string, opts: {
    size?: number; bold?: boolean; color?: [number, number, number]; indent?: number
  } = {}) {
    const sz    = opts.size ?? fontSize
    const f     = opts.bold ? fontB : font
    const [r, g, b] = opts.color ?? [0.13, 0.13, 0.13]
    const x     = margin + (opts.indent ?? 0)
    const maxW  = colW - (opts.indent ?? 0)

    // Word-wrap
    const words = text.split(" ")
    let line = ""
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      const w    = f.widthOfTextAtSize(test, sz)
      if (w > maxW && line) {
        ensureSpace(sz + 4)
        page.drawText(line, { x, y, size: sz, font: f, color: rgb(r, g, b) })
        y -= sz + 4
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      ensureSpace(sz + 4)
      page.drawText(line, { x, y, size: sz, font: f, color: rgb(r, g, b) })
      y -= sz + 4
    }
  }

  function drawRule(thick = false) {
    ensureSpace(12)
    page.drawLine({
      start: { x: margin, y },
      end:   { x: margin + colW, y },
      thickness: thick ? 1.5 : 0.5,
      color: thick ? rgb(0.2, 0.6, 0.4) : rgb(0.7, 0.7, 0.7),
    })
    y -= 10
  }

  function drawKv(key: string, value: string) {
    ensureSpace(lineH + 4)
    page.drawText(key, { x: margin, y, size: fontSize, font: fontB, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(value, { x: margin + 70, y, size: fontSize, font, color: rgb(0.13, 0.13, 0.13) })
    y -= lineH + 2
  }

  // ── Cover block ──────────────────────────────────────────────────────────────
  drawText("Email Thread Export", { size: titleSz, bold: true, color: [0.07, 0.43, 0.27] })
  y -= 4
  drawRule(true)

  drawKv("Company:", company)
  drawKv("Contact:", contact)
  drawKv("Subject:", subject)
  drawKv("Emails:", String(emails.length))
  drawKv("Exported:", formatDate(new Date()))
  y -= 8

  // ── Emails ────────────────────────────────────────────────────────────────────
  for (const email of sorted) {
    drawRule()
    const dir = email.direction === "sent" ? "Outbound" : "Inbound"
    drawText(`${dir} Email`, { size: headSz, bold: true, color: email.direction === "sent" ? [0.06, 0.52, 0.29] : [0.13, 0.37, 0.73] })
    y -= 2
    drawKv("From:", email.fromAddress)
    drawKv("To:", email.toAddress)
    drawKv("Date:", formatDate(email.sentAt))
    drawKv("Subject:", email.subject)
    if (email.direction === "sent") {
      drawKv("Opened:", email.openedAt ? `Yes (${email.openCount}×)` : "No")
      if (email.stageNumber != null) drawKv("Stage:", `S${email.stageNumber}`)
    }
    y -= 4
    const bodyText = email.bodyText?.trim() || "(no body)"
    const lines    = bodyText.split("\n")
    for (const ln of lines) {
      if (ln.trim()) {
        drawText(ln, { indent: 0 })
      } else {
        y -= fontSize
      }
    }
    y -= 6
  }

  // ── Link clicks ───────────────────────────────────────────────────────────────
  const clicks = linkClicks.filter(c => c.clickCount > 0)
  if (clicks.length > 0) {
    drawRule(true)
    drawText("Link Click Events", { size: headSz, bold: true, color: [0.3, 0.3, 0.6] })
    y -= 4
    for (const click of clicks) {
      drawKv("URL:", click.destinationUrl.slice(0, 60) + (click.destinationUrl.length > 60 ? "…" : ""))
      drawKv("Clicks:", String(click.clickCount))
      if (click.firstClickedAt) drawKv("First:", formatDate(click.firstClickedAt))
      y -= 4
    }
  }

  const bytes = await doc.save()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export async function buildBulkZip(
  threads: Array<{
    key:        string
    emails:     ExportEmail[]
    linkClicks: ExportLinkClick[]
    meta?:      { companyName?: string; contactName?: string }
  }>,
  exportedAt: Date = new Date(),
): Promise<ArrayBuffer> {
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

  const dateStr = exportedAt.toISOString().split("T")[0]
  void dateStr  // used in filename at call site

  const buf = await zip.generateAsync({ type: "nodebuffer" }) as Buffer
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}
