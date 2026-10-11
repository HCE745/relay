import { randomBytes } from "node:crypto"
import { orgDb, systemDb, isUniqueViolation } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { addInvoicePayment } from "./invoices"
import { createCheckoutSession, isStripeConfigured } from "../stripe"

// Online payments (Phase 22). Payments ALWAYS post through addInvoicePayment so
// AR aging, status derivation and overpayment refusal keep working — no parallel
// payment path. The webhook is idempotent via ProcessedStripeEvent.

const OUTSTANDING = new Set(["SENT", "PARTIALLY_PAID"])

/** Ensure an invoice has a public pay-link token; returns it. Outstanding only. */
export async function ensurePayLink(orgId: string, invoiceId: string): Promise<string | null> {
  const inv = await orgDb(orgId).invoice.findFirst({ where: { id: invoiceId }, select: { id: true, status: true, payLinkToken: true } })
  if (!inv || !OUTSTANDING.has(inv.status)) return null
  if (inv.payLinkToken) return inv.payLinkToken
  const token = randomBytes(24).toString("base64url")
  await orgDb(orgId).invoice.updateMany({ where: { id: invoiceId }, data: { payLinkToken: token } })
  return token
}

/** Public, login-free lookup of a payable invoice by its token. */
export async function getPayableByToken(token: string) {
  const inv = await systemDb.invoice.findFirst({
    where: { payLinkToken: token },
    select: {
      id: true, organizationId: true, invoiceNumber: true, status: true, currency: true, total: true,
      payments: { select: { amount: true } },
      customer: { select: { name: true, email: true } },
      organization: { select: { name: true } },
    },
  })
  if (!inv) return null
  const paid = inv.payments.reduce((a, p) => a.plus(p.amount), inv.total.minus(inv.total)) // Decimal 0
  const balance = inv.total.minus(paid)
  return {
    invoiceId: inv.id, organizationId: inv.organizationId, invoiceNumber: inv.invoiceNumber,
    status: inv.status, currency: inv.currency,
    total: inv.total.toFixed(2), balance: balance.toFixed(2),
    customerName: inv.customer.name, customerEmail: inv.customer.email, orgName: inv.organization.name,
    payable: OUTSTANDING.has(inv.status) && balance.gt(0),
  }
}

/** Create a Checkout Session for a tokenized (public) pay link. */
export async function createCheckoutForToken(token: string, baseUrl: string): Promise<{ url: string }> {
  if (!isStripeConfigured()) throw new ConflictError("Online payments are not enabled")
  const payable = await getPayableByToken(token)
  assertFound(payable, "Invoice")
  if (!payable!.payable) throw new ConflictError("This invoice is not payable online")
  const amountCents = Math.round(Number(payable!.balance) * 100)
  if (amountCents <= 0) throw new ConflictError("Nothing is due on this invoice")
  const session = await createCheckoutSession({
    amountCents, currency: payable!.currency, invoiceId: payable!.invoiceId, orgId: payable!.organizationId,
    invoiceNumber: payable!.invoiceNumber, customerEmail: payable!.customerEmail ?? undefined,
    successUrl: `${baseUrl}/pay/${token}?paid=1`, cancelUrl: `${baseUrl}/pay/${token}`,
  })
  return { url: session.url }
}

/**
 * Apply a verified Stripe payment event exactly once. Dedupes on the Stripe
 * event id (ProcessedStripeEvent); on a retry/duplicate it no-ops. On first
 * sight it posts through addInvoicePayment. Marking the event processed even
 * when the payment can't apply (voided/overpaid) prevents a retry storm.
 */
export async function applyStripePaymentEvent(input: {
  eventId: string; type: string; orgId: string; invoiceId: string; amountCents: number; method: string; reference?: string
}): Promise<{ applied: boolean; duplicate?: boolean; skipped?: string }> {
  // Claim the event id first — the idempotency guard.
  try {
    await systemDb.processedStripeEvent.create({ data: { id: input.eventId, type: input.type, invoiceId: input.invoiceId } })
  } catch (e) {
    if (isUniqueViolation(e)) return { applied: false, duplicate: true }
    throw e
  }
  const amount = (input.amountCents / 100).toFixed(2)
  try {
    await addInvoicePayment(input.orgId, input.invoiceId, { amount, method: input.method, reference: input.reference })
    return { applied: true }
  } catch (e) {
    // Already claimed the event, so we won't retry; record why it didn't apply.
    return { applied: false, skipped: e instanceof Error ? e.message : "could not apply" }
  }
}
