import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { claimOnce } from "./idempotency"
import { runPaymentReminders } from "./customer-comms"
import { notifyCustomerVia } from "../notifications/dispatch"
import { ZERO } from "../billing-math"
import { DateTime } from "luxon"

// Multi-step collections (Phase 44). An ordered dunning sequence keyed off days
// past the invoice due date, each step email or SMS with an editable template.
// It stops automatically when the invoice is paid (only outstanding invoices are
// processed), and a per-customer opt-out or per-invoice hold suppresses it.
// Every send routes through the Phase 21 notification system (NotificationLog)
// and also records a CollectionActivity row for the invoice/customer timeline.
// When no steps are configured, falls back to the legacy single reminder.

type StepInput = { dayOffset: number; channel: "EMAIL" | "SMS"; subject?: string; body: string; order?: number }

export async function listCollectionSteps(orgId: string) {
  return orgDb(orgId).collectionStep.findMany({ orderBy: [{ isActive: "desc" }, { dayOffset: "asc" }] })
}

export async function createCollectionStep(orgId: string, input: StepInput) {
  return orgDb(orgId).collectionStep.create({
    data: {
      organizationId: orgId, dayOffset: input.dayOffset, channel: input.channel,
      subject: input.subject ?? null, body: input.body, order: input.order ?? input.dayOffset,
    },
  })
}

export async function updateCollectionStep(orgId: string, id: string, input: Partial<StepInput> & { isActive?: boolean }) {
  const data: Record<string, unknown> = {}
  if (input.dayOffset !== undefined) { data.dayOffset = input.dayOffset; if (input.order === undefined) data.order = input.dayOffset }
  if (input.order !== undefined) data.order = input.order
  if (input.channel !== undefined) data.channel = input.channel
  if (input.subject !== undefined) data.subject = input.subject ?? null
  if (input.body !== undefined) data.body = input.body
  if (input.isActive !== undefined) data.isActive = input.isActive
  const res = await orgDb(orgId).collectionStep.updateMany({ where: { id }, data })
  assertFound(res.count > 0 ? {} : null, "Collection step")
  return orgDb(orgId).collectionStep.findFirst({ where: { id } })
}

export async function setCustomerCollectionsOptOut(orgId: string, customerId: string, optOut: boolean) {
  const res = await orgDb(orgId).customer.updateMany({ where: { id: customerId }, data: { collectionsOptOut: optOut } })
  assertFound(res.count > 0 ? {} : null, "Customer")
  return { ok: true }
}

export async function setInvoiceCollectionsHold(orgId: string, invoiceId: string, hold: boolean) {
  const res = await orgDb(orgId).invoice.updateMany({ where: { id: invoiceId }, data: { collectionsHold: hold } })
  assertFound(res.count > 0 ? {} : null, "Invoice")
  return { ok: true }
}

export function listInvoiceCollectionActivity(orgId: string, invoiceId: string) {
  return orgDb(orgId).collectionActivity.findMany({ where: { invoiceId }, orderBy: { createdAt: "desc" } })
}

/** Fill template placeholders. Unknown tokens are left as-is. */
function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
}

/**
 * Run the collection sequence for an org. For each outstanding, overdue, not-held
 * invoice of a non-opted-out customer, fire the most-escalated step whose day
 * offset has been reached and that has not fired yet; earlier eligible steps are
 * superseded (recorded, not sent). Idempotent per (invoice, step) via claimOnce.
 */
export async function runCollections(orgId: string, now: Date = new Date()): Promise<{ sent: number; usedSequence: boolean }> {
  const db = orgDb(orgId)
  const steps = await db.collectionStep.findMany({ where: { isActive: true }, orderBy: { dayOffset: "asc" } })
  if (steps.length === 0) {
    // No sequence configured — keep the legacy single overdue reminder.
    const sent = await runPaymentReminders(orgId, now)
    return { sent, usedSequence: false }
  }

  const invoices = await db.invoice.findMany({
    where: {
      status: { in: ["SENT", "PARTIALLY_PAID"] },
      dueDate: { lt: now },
      collectionsHold: false,
      customer: { collectionsOptOut: false },
    },
    select: {
      id: true, invoiceNumber: true, total: true, currency: true, dueDate: true, customerId: true,
      customer: { select: { name: true } }, payments: { select: { amount: true } },
    },
  })

  let sent = 0
  for (const inv of invoices) {
    const paid = inv.payments.reduce((a, p) => a.plus(p.amount), ZERO)
    const balance = inv.total.minus(paid)
    if (balance.lessThanOrEqualTo(ZERO)) continue // paid → sequence stops
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000)
    const eligible = steps.filter((s) => s.dayOffset <= daysOverdue)
    if (eligible.length === 0) continue
    const target = eligible[eligible.length - 1]

    for (const s of eligible) {
      const fresh = await claimOnce(orgId, "collection-step", `${inv.id}:${s.id}`)
      if (!fresh) continue // already handled on a prior run
      if (s.id !== target.id) {
        // A less-escalated step we skipped past — record it so the timeline is honest.
        await db.collectionActivity.create({
          data: { organizationId: orgId, invoiceId: inv.id, customerId: inv.customerId, stepOrder: s.order, dayOffset: s.dayOffset, channel: s.channel, status: "SKIPPED", detail: "superseded" },
        })
        continue
      }
      const vars = {
        customerName: inv.customer.name,
        invoiceNumber: `#${inv.invoiceNumber}`,
        balance: `${balance.toFixed(2)} ${inv.currency}`,
        daysOverdue: String(daysOverdue),
        dueDate: DateTime.fromJSDate(inv.dueDate).toFormat("LLL d, yyyy"),
      }
      const subject = render(s.subject ?? `Invoice ${vars.invoiceNumber} is past due`, vars)
      const body = render(s.body, vars)
      const res = await notifyCustomerVia(orgId, inv.customerId, "COLLECTION_STEP", s.channel, { subject, body })
      await db.collectionActivity.create({
        data: { organizationId: orgId, invoiceId: inv.id, customerId: inv.customerId, stepOrder: s.order, dayOffset: s.dayOffset, channel: s.channel, status: res.status, detail: res.detail ?? null },
      })
      if (res.status === "SENT") sent++
    }
  }
  return { sent, usedSequence: true }
}
