import { orgDb } from "../org-db"
import { getInvoice } from "./invoices"
import { getEstimate } from "./estimates"
import { getOrgSettings } from "./org"
import { ConflictError, RequirementsError } from "./errors"
import { formatMoney, invoiceNo } from "../money"
import { renderInvoicePdf, renderEstimatePdf, type InvoicePdfData, type EstimatePdfData } from "../pdf/render"
import { isEmailConfigured, sendEmail } from "../email"

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
const num = (d: { toString(): string }) => Number(d.toString()).toString()

const INV_STATUS: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", PARTIALLY_PAID: "Partially paid", PAID: "Paid", VOID: "Void" }
const EST_STATUS: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", ACCEPTED: "Accepted", DECLINED: "Declined", EXPIRED: "Expired" }
const FREQ: Record<string, string> = { ONE_TIME: "One-time", DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly", CUSTOM: "Custom" }

// ─── Invoice PDF ─────────────────────────────────────────────────────────────

async function invoicePdfData(orgId: string, id: string): Promise<{ data: InvoicePdfData; number: number } | null> {
  const [inv, org] = await Promise.all([getInvoice(orgId, id), getOrgSettings(orgId)])
  if (!inv) return null
  const cur = inv.currency
  const paid = inv.payments.reduce((a, p) => a + Number(p.amount.toFixed(2)), 0)
  const balance = Number(inv.total.toFixed(2)) - paid
  const billTo = [inv.customer.name, inv.customer.billingEmail ?? inv.customer.email ?? "", inv.customer.billingAddress ?? ""].filter(Boolean) as string[]
  return {
    number: inv.invoiceNumber,
    data: {
      orgName: org?.name ?? "HCE Cleaning",
      invoiceNo: invoiceNo(inv.invoiceNumber),
      statusLabel: INV_STATUS[inv.status] ?? inv.status,
      billTo,
      issueDate: fmtDate(inv.issueDate),
      dueDate: fmtDate(inv.dueDate),
      period: `${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`,
      lines: inv.lines.map((l) => ({
        description: l.description,
        site: l.siteName ?? undefined,
        serviceDate: fmtDate(l.serviceDate),
        qty: num(l.quantity),
        rate: formatMoney(l.unitRate, cur),
        amount: formatMoney(l.amount, cur),
      })),
      subtotal: formatMoney(inv.subtotal, cur),
      tax: formatMoney(inv.taxTotal, cur),
      total: formatMoney(inv.total, cur),
      paid: paid > 0 ? formatMoney(paid, cur) : undefined,
      balance: formatMoney(balance, cur),
      notes: inv.notes ?? undefined,
    },
  }
}

export async function getInvoicePdf(orgId: string, id: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const r = await invoicePdfData(orgId, id)
  if (!r) return null
  return { buffer: await renderInvoicePdf(r.data), filename: `${invoiceNo(r.number)}.pdf` }
}

/** Email the invoice PDF to the customer's billing email. Caller gates on isEmailConfigured(). */
export async function sendInvoiceEmail(orgId: string, id: string): Promise<{ sent: boolean; error?: string } | null> {
  if (!isEmailConfigured()) throw new ConflictError("Email delivery is not configured")
  const [inv, org] = await Promise.all([getInvoice(orgId, id), getOrgSettings(orgId)])
  if (!inv) return null
  if (inv.status === "VOID") throw new ConflictError("Cannot email a voided invoice")
  const to = inv.customer.billingEmail ?? inv.customer.email
  if (!to) throw new RequirementsError("This customer has no billing email", ["Add a billing email on the customer before emailing"])

  const built = await invoicePdfData(orgId, id)
  const pdf = await renderInvoicePdf(built!.data)
  const orgName = org?.name ?? "HCE Cleaning"
  const label = invoiceNo(inv.invoiceNumber)
  const res = await sendEmail({
    to,
    subject: `Invoice ${label} from ${orgName}`,
    text: `Hi ${inv.customer.name},\n\nPlease find invoice ${label} attached (total ${formatMoney(inv.total, inv.currency)}, due ${fmtDate(inv.dueDate)}).\n\nThank you,\n${orgName}`,
    attachments: [{ filename: `${label}.pdf`, content: pdf.toString("base64") }],
  })
  if (!res.delivered) return { sent: false, error: res.error ?? "The message was not delivered" }

  // Emailing issues a draft; always stamp emailedAt.
  await orgDb(orgId).invoice.updateMany({
    where: { id },
    data: { emailedAt: new Date(), ...(inv.status === "DRAFT" ? { status: "SENT" as const } : {}) },
  })
  return { sent: true }
}

// ─── Estimate PDF ────────────────────────────────────────────────────────────

async function estimatePdfData(orgId: string, id: string): Promise<{ data: EstimatePdfData; title: string } | null> {
  const [est, org] = await Promise.all([getEstimate(orgId, id), getOrgSettings(orgId)])
  if (!est) return null
  const cur = est.currency
  const rate = est.rate ? formatMoney(est.rate, cur) : null
  const preparedFor = [
    est.customer?.name ?? est.lead?.company ?? est.contactName ?? "—",
    est.contactName && (est.customer || est.lead?.company) ? est.contactName : "",
    est.contactEmail ?? "",
    [est.siteName, est.addressLine1, [est.city, est.state].filter(Boolean).join(", "), est.postalCode].filter(Boolean).join(" · "),
  ].filter(Boolean) as string[]
  return {
    title: est.title,
    data: {
      orgName: org?.name ?? "HCE Cleaning",
      title: est.title,
      statusLabel: est.convertedCustomerId ? "Converted" : (EST_STATUS[est.status] ?? est.status),
      preparedFor,
      frequency: FREQ[est.frequency] ?? est.frequency,
      pricing: est.pricing === "HOURLY" ? `Hourly${rate ? ` · ${rate}/hr` : ""}` : `Per visit${rate ? ` · ${rate}` : ""}`,
      validUntil: est.validUntil ? fmtDate(est.validUntil) : "—",
      lines: est.lines.map((l) => ({ description: l.description, qty: num(l.quantity), rate: formatMoney(l.unitRate, cur), amount: formatMoney(l.amount, cur) })),
      subtotal: formatMoney(est.subtotal, cur),
      total: formatMoney(est.total, cur),
      notes: est.notes ?? undefined,
    },
  }
}

export async function getEstimatePdf(orgId: string, id: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const r = await estimatePdfData(orgId, id)
  if (!r) return null
  const safe = r.title.replace(/[^\w-]+/g, "-").slice(0, 40) || "estimate"
  return { buffer: await renderEstimatePdf(r.data), filename: `estimate-${safe}.pdf` }
}
