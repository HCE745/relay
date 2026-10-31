// Phase 44 integration verification: multi-step collections.
//  - the most-escalated due step fires; earlier due steps are superseded
//  - idempotent: a second run on the same day sends nothing new
//  - a later step fires when its day offset is reached
//  - paying the invoice stops the sequence; a per-invoice hold and a
//    per-customer opt-out both suppress it
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase44-collections.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { createCollectionStep, runCollections, setInvoiceCollectionsHold, setCustomerCollectionsOptOut } from "../src/lib/data/collections"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function overdueInvoice(orgId: string, customerId: string, num: number, dueDaysAgo: number, now: Date) {
  const issue = new Date(now.getTime() - (dueDaysAgo + 30) * 86_400_000)
  const due = new Date(now.getTime() - dueDaysAgo * 86_400_000)
  return systemDb.invoice.create({
    data: {
      organizationId: orgId, customerId, invoiceNumber: num, status: "SENT", issueDate: issue, dueDate: due,
      periodStart: issue, periodEnd: due, currency: "USD", subtotal: "500.00", taxTotal: "0", total: "500.00",
    },
    select: { id: true },
  })
}
const activityCount = (orgId: string, invoiceId: string) => orgDb(orgId).collectionActivity.count({ where: { invoiceId } })

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Coll Co", slug: `cl-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme", email: `ap-${stamp}@acme.co` }, select: { id: true } })
  await createCollectionStep(org.id, { dayOffset: 3, channel: "EMAIL", subject: "Past due {invoiceNumber}", body: "Hi {customerName}, {invoiceNumber} for {balance} is {daysOverdue} days overdue." })
  await createCollectionStep(org.id, { dayOffset: 10, channel: "EMAIL", body: "Second notice for {invoiceNumber}." })
  await createCollectionStep(org.id, { dayOffset: 21, channel: "SMS", body: "Final notice {invoiceNumber}." })

  const now = new Date("2026-06-20T12:00:00.000Z")
  const inv = await overdueInvoice(org.id, cust.id, 2001, 15, now) // 15 days overdue

  console.log("Most-escalated due step fires; earlier is superseded:")
  const r1 = await runCollections(org.id, now)
  check("used the sequence", r1.usedSequence === true)
  const acts = await orgDb(org.id).collectionActivity.findMany({ where: { invoiceId: inv.id }, orderBy: { dayOffset: "asc" } })
  check("two activity rows (day3 superseded, day10 fired)", acts.length === 2)
  check("day3 was superseded", acts.find((a) => a.dayOffset === 3)?.status === "SKIPPED" && acts.find((a) => a.dayOffset === 3)?.detail === "superseded")
  check("day10 was the fired step", acts.some((a) => a.dayOffset === 10 && a.detail !== "superseded"))

  console.log("\nIdempotent — a second run the same day adds nothing:")
  await runCollections(org.id, now)
  check("still two activity rows", (await activityCount(org.id, inv.id)) === 2)

  console.log("\nThe next step fires when its day offset is reached:")
  const later = new Date(now.getTime() + 10 * 86_400_000) // now 25 days overdue
  await runCollections(org.id, later)
  const acts2 = await orgDb(org.id).collectionActivity.findMany({ where: { invoiceId: inv.id } })
  check("day21 step now recorded", acts2.some((a) => a.dayOffset === 21))

  console.log("\nPayment stops the sequence:")
  const paid = await overdueInvoice(org.id, cust.id, 2002, 15, now)
  await systemDb.invoicePayment.create({ data: { invoiceId: paid.id, amount: "500.00", method: "ACH", receivedDate: now } })
  await systemDb.invoice.updateMany({ where: { id: paid.id }, data: { status: "PAID" } })
  await runCollections(org.id, now)
  check("a fully-paid invoice gets no reminders", (await activityCount(org.id, paid.id)) === 0)

  console.log("\nHold and opt-out suppress the sequence:")
  const held = await overdueInvoice(org.id, cust.id, 2003, 15, now)
  await setInvoiceCollectionsHold(org.id, held.id, true)
  await runCollections(org.id, now)
  check("a held invoice gets no reminders", (await activityCount(org.id, held.id)) === 0)

  const optCust = await systemDb.customer.create({ data: { organizationId: org.id, name: "OptOut Inc", email: `o-${stamp}@t.co` }, select: { id: true } })
  const optInv = await overdueInvoice(org.id, optCust.id, 2004, 15, now)
  await setCustomerCollectionsOptOut(org.id, optCust.id, true)
  await runCollections(org.id, now)
  check("an opted-out customer gets no reminders", (await activityCount(org.id, optInv.id)) === 0)

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL COLLECTIONS CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
