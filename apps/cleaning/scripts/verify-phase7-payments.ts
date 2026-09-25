// Phase 7 integration verification against a live database. Focus: status is
// DERIVED from payments (SENT → PARTIALLY_PAID → PAID), overpayment is refused
// (never a negative balance), PAID cannot be set by hand, PDFs render from real
// data, and the email path is gated by config + a billing address.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase7-payments.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { generateInvoice, setInvoiceStatus, addInvoicePayment, getInvoice } from "../src/lib/data/invoices"
import { getInvoicePdf, getEstimatePdf, sendInvoiceEmail } from "../src/lib/data/documents"
import { createEstimate } from "../src/lib/data/estimates"
import { isEmailConfigured } from "../src/lib/email"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}
const statusOf = async (id: string) => (await systemDb.invoice.findUniqueOrThrow({ where: { id } })).status
const balanceOf = (inv: { total: { toString(): string }; payments: { amount: { toString(): string } }[] }) =>
  Number(inv.total.toString()) - inv.payments.reduce((a, p) => a + Number(p.amount.toString()), 0)

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Pay Test", slug: `pay-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme", paymentTerms: "NET_15", billingEmail: "acme@test.co" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" } })
  const mkInvoice = async (day: number, period: [string, string]) => {
    const plan = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site.id, name: `Plan ${day}`, billingType: "FLAT_PER_JOB", rate: "300.00" } })
    await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: `Job ${day}`, status: "COMPLETED", scheduledStart: new Date(`2026-${period[0].slice(5, 7)}-${String(day).padStart(2, "0")}T09:00:00Z`), actualEnd: new Date(`2026-${period[0].slice(5, 7)}-${String(day).padStart(2, "0")}T10:00:00Z`) } })
    const r = await generateInvoice(org.id, { customerId: customer.id, periodStart: period[0], periodEnd: period[1] })
    return r.created ? r.invoiceId : ""
  }

  console.log("Status derives from payments (SENT → PARTIALLY_PAID → PAID):")
  const inv1 = await mkInvoice(10, ["2026-09-01", "2026-09-30"])
  await setInvoiceStatus(org.id, inv1, "SENT")
  check("issued → SENT", (await statusOf(inv1)) === "SENT")
  await addInvoicePayment(org.id, inv1, { amount: "120" })
  check("partial payment → PARTIALLY_PAID (distinct state)", (await statusOf(inv1)) === "PARTIALLY_PAID")
  const afterPartial = await getInvoice(org.id, inv1)
  check("balance is 180.00 after 120 of 300", balanceOf(afterPartial!) === 180)
  await addInvoicePayment(org.id, inv1, { amount: "180" })
  check("balance covered → PAID", (await statusOf(inv1)) === "PAID")

  console.log("Overpayment is refused — no negative balance:")
  const inv2 = await mkInvoice(10, ["2026-10-01", "2026-10-31"])
  await setInvoiceStatus(org.id, inv2, "SENT")
  check("cannot set PAID by hand (derives from payments)", (await threw(() => setInvoiceStatus(org.id, inv2, "PAID" as never))) !== null)
  await addInvoicePayment(org.id, inv2, { amount: "100" })
  const over = await threw(() => addInvoicePayment(org.id, inv2, { amount: "250" })) // remaining is 200
  check("payment beyond the balance is refused", over !== null && /exceeds the remaining balance/i.test(over ?? ""))
  const stillOwed = await getInvoice(org.id, inv2)
  check("balance unchanged by the refused payment (still 200.00)", balanceOf(stillOwed!) === 200 && stillOwed!.status === "PARTIALLY_PAID")
  await addInvoicePayment(org.id, inv2, { amount: "200" }) // exact
  check("exact remaining payment → PAID, balance 0", (await statusOf(inv2)) === "PAID" && balanceOf((await getInvoice(org.id, inv2))!) === 0)

  console.log("PDFs render from real data (no email/domain needed):")
  const invPdf = await getInvoicePdf(org.id, inv1)
  check("invoice PDF is a real %PDF file", !!invPdf && invPdf.buffer.subarray(0, 5).toString() === "%PDF-" && invPdf.buffer.length > 800, invPdf ? `${invPdf.buffer.length}b` : "null")
  const est = await createEstimate(org.id, { title: "Quote", pricing: "PER_VISIT", lines: [{ description: "Clean", quantity: "1", unitRate: "300" }] })
  const estPdf = await getEstimatePdf(org.id, est.id)
  check("estimate PDF is a real %PDF file", !!estPdf && estPdf.buffer.subarray(0, 5).toString() === "%PDF-")

  console.log("Email path is gated by config, then by a billing address:")
  check("email not configured in this env", isEmailConfigured() === false)
  const unconfigured = await threw(() => sendInvoiceEmail(org.id, inv1))
  check("send refused when unconfigured", unconfigured !== null && /not configured/i.test(unconfigured ?? ""))
  process.env.RESEND_API_KEY = "test-key"
  process.env.CLEANING_EMAIL_FROM = "HCE <billing@example.com>"
  check("now reports configured", isEmailConfigured() === true)
  await systemDb.customer.update({ where: { id: customer.id }, data: { billingEmail: null, email: null } })
  const noAddr = await threw(() => sendInvoiceEmail(org.id, inv1))
  check("configured but no billing address → refused with a reason", noAddr !== null && /billing email/i.test(noAddr ?? ""))

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL PAYMENT/DELIVERY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
