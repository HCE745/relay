import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib"

// Invoice + estimate PDF generation with pdf-lib — self-contained (standard
// fonts, no network, no fragile transitive deps), so an owner can produce a PDF
// today with no email/domain configured. Callers pass already-formatted plain
// strings (money as "$0.00", dates preformatted); no Decimals cross this line.

const PW = 612
const PH = 792
const M = 48
const INK = rgb(0.06, 0.09, 0.16)
const MUT = rgb(0.39, 0.45, 0.55)
const FAINT = rgb(0.61, 0.64, 0.69)
const LINE = rgb(0.88, 0.91, 0.94)
const RULE = rgb(0.79, 0.83, 0.88)

// Right-edge x of each numeric column.
const AMT_R = PW - M
const RATE_R = AMT_R - 74
const QTY_R = RATE_R - 46
const DATE_R = QTY_R - 58
const DESC_MAX = DATE_R - M - 70

type Fonts = { font: PDFFont; bold: PDFFont }

function rightText(page: PDFPage, str: string, xRight: number, y: number, size: number, font: PDFFont, color = INK) {
  page.drawText(str, { x: xRight - font.widthOfTextAtSize(str, size), y, size, font, color })
}
function hline(page: PDFPage, y: number, color = LINE) {
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color })
}
function truncate(font: PDFFont, str: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(str, size) <= maxW) return str
  let out = str
  while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > maxW) out = out.slice(0, -1)
  return out + "…"
}

function docHeader(page: PDFPage, f: Fonts, orgName: string, kind: string, docTitle: string, statusLabel: string, meta: [string, string][]) {
  const y = PH - M
  page.drawText(orgName, { x: M, y: y - 12, size: 15, font: f.bold, color: INK })
  page.drawText(kind.toUpperCase(), { x: M, y: y - 26, size: 8, font: f.font, color: FAINT })
  rightText(page, truncate(f.bold, docTitle, 16, 240), PW - M, y - 12, 16, f.bold, INK)
  rightText(page, statusLabel, PW - M, y - 28, 9, f.bold, MUT)
  let my = y - 46
  for (const [k, v] of meta) {
    rightText(page, k, PW - M - 100, my, 9, f.font, FAINT)
    rightText(page, v, PW - M, my, 9, f.font, INK)
    my -= 12
  }
  return y - 84
}

function tableHeader(page: PDFPage, f: Fonts, y: number, withDate: boolean) {
  page.drawText("DESCRIPTION", { x: M, y, size: 8, font: f.font, color: FAINT })
  if (withDate) rightText(page, "SERVICE DATE", DATE_R, y, 8, f.font, FAINT)
  rightText(page, "QTY", QTY_R, y, 8, f.font, FAINT)
  rightText(page, "RATE", RATE_R, y, 8, f.font, FAINT)
  rightText(page, "AMOUNT", AMT_R, y, 8, f.font, FAINT)
  hline(page, y - 5, RULE)
  return y - 20
}

export type InvoicePdfData = {
  orgName: string
  invoiceNo: string
  statusLabel: string
  billTo: string[]
  issueDate: string
  dueDate: string
  period: string
  lines: { description: string; site?: string; serviceDate: string; qty: string; rate: string; amount: string }[]
  subtotal: string
  tax: string
  total: string
  paid?: string
  balance: string
  notes?: string
}

export async function renderInvoicePdf(d: InvoicePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const f = { font, bold }
  let page = doc.addPage([PW, PH])

  let y = docHeader(page, f, d.orgName, "Invoice", d.invoiceNo, d.statusLabel, [
    ["Issued", d.issueDate],
    ["Due", d.dueDate],
    ["Period", d.period],
  ])
  page.drawText("BILL TO", { x: M, y, size: 8, font: font, color: FAINT })
  y -= 12
  d.billTo.forEach((l, i) => {
    page.drawText(truncate(i === 0 ? bold : font, l, 10, 260), { x: M, y, size: 10, font: i === 0 ? bold : font, color: i === 0 ? INK : MUT })
    y -= 12
  })
  hline(page, y - 4)
  y -= 22

  y = tableHeader(page, f, y, true)
  for (const l of d.lines) {
    if (y < 120) { page = doc.addPage([PW, PH]); y = PH - M - 20; y = tableHeader(page, f, y, true) }
    page.drawText(truncate(font, l.description, 10, DESC_MAX), { x: M, y, size: 10, font, color: INK })
    rightText(page, l.serviceDate, DATE_R, y, 9, font, MUT)
    rightText(page, l.qty, QTY_R, y, 9, font, MUT)
    rightText(page, l.rate, RATE_R, y, 9, font, MUT)
    rightText(page, l.amount, AMT_R, y, 10, font, INK)
    if (l.site) { y -= 11; page.drawText(truncate(font, l.site, 8, DESC_MAX), { x: M, y, size: 8, font, color: FAINT }) }
    hline(page, y - 6)
    y -= 18
  }

  y -= 6
  const totals: [string, string, boolean][] = [
    ["Subtotal", d.subtotal, false],
    ["Tax", d.tax, false],
    ["Total", d.total, true],
    ...(d.paid ? ([["Paid", d.paid, false]] as [string, string, boolean][]) : []),
    ["Balance due", d.balance, true],
  ]
  for (const [k, v, strong] of totals) {
    if (strong) hline(page, y + 12, RULE)
    rightText(page, k, AMT_R - 120, y, 10, strong ? bold : font, strong ? INK : MUT)
    rightText(page, v, AMT_R, y, 10, strong ? bold : font, INK)
    y -= 16
  }
  if (d.notes) page.drawText(truncate(font, d.notes, 9, PW - 2 * M), { x: M, y: y - 10, size: 9, font, color: MUT })

  return Buffer.from(await doc.save())
}

export type EstimatePdfData = {
  orgName: string
  title: string
  statusLabel: string
  preparedFor: string[]
  frequency: string
  pricing: string
  validUntil: string
  lines: { description: string; qty: string; rate: string; amount: string }[]
  subtotal: string
  total: string
  notes?: string
}

export async function renderEstimatePdf(d: EstimatePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const f = { font, bold }
  let page = doc.addPage([PW, PH])

  let y = docHeader(page, f, d.orgName, "Estimate", d.title, d.statusLabel, [
    ["Frequency", d.frequency],
    ["Pricing", d.pricing],
    ["Valid until", d.validUntil],
  ])
  page.drawText("PREPARED FOR", { x: M, y, size: 8, font, color: FAINT })
  y -= 12
  d.preparedFor.forEach((l, i) => {
    page.drawText(truncate(i === 0 ? bold : font, l, 10, 260), { x: M, y, size: 10, font: i === 0 ? bold : font, color: i === 0 ? INK : MUT })
    y -= 12
  })
  hline(page, y - 4)
  y -= 22

  y = tableHeader(page, f, y, false)
  if (d.lines.length === 0) { page.drawText("No line items.", { x: M, y, size: 10, font, color: MUT }); y -= 18 }
  for (const l of d.lines) {
    if (y < 120) { page = doc.addPage([PW, PH]); y = PH - M - 20; y = tableHeader(page, f, y, false) }
    page.drawText(truncate(font, l.description, 10, DESC_MAX + 58), { x: M, y, size: 10, font, color: INK })
    rightText(page, l.qty, QTY_R, y, 9, font, MUT)
    rightText(page, l.rate, RATE_R, y, 9, font, MUT)
    rightText(page, l.amount, AMT_R, y, 10, font, INK)
    hline(page, y - 6)
    y -= 18
  }

  y -= 6
  rightText(page, "Subtotal", AMT_R - 120, y, 10, font, MUT)
  rightText(page, d.subtotal, AMT_R, y, 10, font, INK)
  y -= 16
  hline(page, y + 12, RULE)
  rightText(page, "Total", AMT_R - 120, y, 10, bold, INK)
  rightText(page, d.total, AMT_R, y, 10, bold, INK)
  y -= 18
  if (d.notes) page.drawText(truncate(font, d.notes, 9, PW - 2 * M), { x: M, y: y - 10, size: 9, font, color: MUT })

  return Buffer.from(await doc.save())
}
