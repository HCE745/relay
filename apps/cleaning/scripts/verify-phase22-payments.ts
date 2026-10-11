// Phase 22 integration verification: online payments.
//  - a pay link is minted only for an outstanding invoice
//  - a verified Stripe event posts through the NORMAL InvoicePayment path, so
//    status derivation + AR keep working
//  - the webhook is idempotent: a retried event id never double-applies
//  - overpayment is still refused (the event is marked processed, not retried)
// (Signature rejection is proven in src/lib/__tests__/stripe-webhook.test.ts.)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase22-payments.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { ensurePayLink, getPayableByToken, applyStripePaymentEvent } from "../src/lib/data/payments"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function makeInvoice(orgId: string, customerId: string, n: number, status: "DRAFT" | "SENT", total: string) {
  return systemDb.invoice.create({
    data: {
      organizationId: orgId, customerId, invoiceNumber: n, status, issueDate: new Date(), dueDate: new Date(),
      periodStart: new Date(), periodEnd: new Date(), currency: "USD", subtotal: total, taxTotal: "0", total,
    },
    select: { id: true },
  })
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Pay Co", slug: `pay-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme", paymentTerms: "DUE_ON_RECEIPT" } })

  console.log("Pay link only for outstanding invoices:")
  const draft = await makeInvoice(org.id, customer.id, 1, "DRAFT", "100.00")
  const sent = await makeInvoice(org.id, customer.id, 2, "SENT", "100.00")
  check("no pay link for a DRAFT invoice", (await ensurePayLink(org.id, draft.id)) === null)
  const token = await ensurePayLink(org.id, sent.id)
  check("pay link minted for a SENT invoice", !!token)
  check("ensurePayLink is idempotent (same token)", (await ensurePayLink(org.id, sent.id)) === token)

  const payable = await getPayableByToken(token!)
  check("public lookup shows the full balance due", payable?.payable === true && payable?.balance === "100.00")

  console.log("\nVerified event posts through InvoicePayment + is idempotent:")
  const r1 = await applyStripePaymentEvent({ eventId: "evt_A", type: "checkout.session.completed", orgId: org.id, invoiceId: sent.id, amountCents: 6000, method: "card", reference: "pi_A" })
  check("first event applies", r1.applied === true)
  const r1dup = await applyStripePaymentEvent({ eventId: "evt_A", type: "checkout.session.completed", orgId: org.id, invoiceId: sent.id, amountCents: 6000, method: "card", reference: "pi_A" })
  check("retried SAME event id is a no-op (idempotent)", r1dup.applied === false && r1dup.duplicate === true)
  const payments1 = await systemDb.invoicePayment.count({ where: { invoiceId: sent.id } })
  check("exactly one payment recorded despite the retry", payments1 === 1, `payments=${payments1}`)
  const after1 = await systemDb.invoice.findUniqueOrThrow({ where: { id: sent.id } })
  check("status derived to PARTIALLY_PAID", after1.status === "PARTIALLY_PAID", `status=${after1.status}`)

  console.log("\nSecond (distinct) event pays the balance → PAID:")
  const r2 = await applyStripePaymentEvent({ eventId: "evt_B", type: "checkout.session.completed", orgId: org.id, invoiceId: sent.id, amountCents: 4000, method: "ach", reference: "pi_B" })
  check("second event applies", r2.applied === true)
  const after2 = await systemDb.invoice.findUniqueOrThrow({ where: { id: sent.id } })
  check("fully paid → status PAID", after2.status === "PAID")

  console.log("\nOverpayment refused (event marked processed, not retried):")
  const r3 = await applyStripePaymentEvent({ eventId: "evt_C", type: "checkout.session.completed", orgId: org.id, invoiceId: sent.id, amountCents: 5000, method: "card", reference: "pi_C" })
  check("overpay does not apply", r3.applied === false && !!r3.skipped)
  check("no extra payment created", (await systemDb.invoicePayment.count({ where: { invoiceId: sent.id } })) === 2)
  check("but the event id IS recorded (won't be retried)", (await systemDb.processedStripeEvent.count({ where: { id: "evt_C" } })) === 1)

  await systemDb.organization.delete({ where: { id: org.id } })
  await systemDb.processedStripeEvent.deleteMany({ where: { id: { in: ["evt_A", "evt_B", "evt_C"] } } })
  console.log(`\n${failures === 0 ? "ALL PAYMENT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
