// Phase 26 integration verification: customer communications.
//  - service completion summary sent once per completed job (opt-out respected)
//  - pre-visit reminders only for opted-in customers, once per job
//  - late-payment reminders once per overdue invoice (toggle respected)
//  - two-way messaging: staff + portal posts land in one thread; staff send logs
//  - everything logs to NotificationLog (here unconfigured → SKIPPED; clean degrade)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase26-comms.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { sendServiceSummary, runVisitReminders, runPaymentReminders } from "../src/lib/data/customer-comms"
import { postStaffMessage, portalPostMessage, listCustomerMessages, countUnreadFromCustomers } from "../src/lib/data/messages"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
const logs = (orgId: string, event: string) => systemDb.notificationLog.count({ where: { organizationId: orgId, event: event as "SERVICE_SUMMARY" } })

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Comms Co", slug: `cm-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC", visitReminderLeadHours: 24, paymentRemindersEnabled: true } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const optIn = await systemDb.customer.create({ data: { organizationId: org.id, name: "OptIn Co", email: `opt-${stamp}@c.co`, visitRemindersOptIn: true, serviceSummariesOptIn: true } })
  const optOut = await systemDb.customer.create({ data: { organizationId: org.id, name: "OptOut Co", email: `out-${stamp}@c.co`, visitRemindersOptIn: false, serviceSummariesOptIn: false } })
  const siteIn = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: optIn.id, name: "In HQ", timezone: "UTC" } })
  const siteOut = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: optOut.id, name: "Out HQ", timezone: "UTC" } })
  const now = new Date()

  console.log("Service completion summary (opt-out respected, once):")
  const doneJob = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: siteIn.id, title: "Nightly", status: "COMPLETED", scheduledStart: new Date(now.getTime() - 3600_000), actualEnd: now }, select: { id: true } })
  await sendServiceSummary(org.id, doneJob.id)
  await sendServiceSummary(org.id, doneJob.id) // retry → dedup
  check("summary sent once for opted-in customer", (await logs(org.id, "SERVICE_SUMMARY")) === 1, `logs=${await logs(org.id, "SERVICE_SUMMARY")}`)
  const outJob = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: siteOut.id, title: "Nightly", status: "COMPLETED", scheduledStart: new Date(now.getTime() - 3600_000), actualEnd: now }, select: { id: true } })
  await sendServiceSummary(org.id, outJob.id)
  check("no summary for opted-out customer", (await logs(org.id, "SERVICE_SUMMARY")) === 1)

  console.log("\nVisit reminders (opted-in only, once per job):")
  const soonIn = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: siteIn.id, title: "Morning", status: "SCHEDULED", scheduledStart: new Date(now.getTime() + 3 * 3600_000) }, select: { id: true } })
  await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: siteOut.id, title: "Morning", status: "SCHEDULED", scheduledStart: new Date(now.getTime() + 3 * 3600_000) } })
  const r1 = await runVisitReminders(org.id, now)
  check("one reminder (opted-in only)", r1 === 1, `sent=${r1}`)
  check("re-run sends none (idempotent)", (await runVisitReminders(org.id, now)) === 0)
  void soonIn

  console.log("\nLate-payment reminders (once per overdue invoice; toggle respected):")
  const inv = await systemDb.invoice.create({ data: { organizationId: org.id, customerId: optIn.id, invoiceNumber: 1, status: "SENT", issueDate: new Date(now.getTime() - 40 * 86_400_000), dueDate: new Date(now.getTime() - 10 * 86_400_000), periodStart: new Date(), periodEnd: new Date(), currency: "USD", subtotal: "200.00", taxTotal: "0", total: "200.00" }, select: { id: true } })
  const p1 = await runPaymentReminders(org.id, now)
  check("one payment reminder for the overdue invoice", p1 === 1, `sent=${p1}`)
  check("re-run sends none (idempotent)", (await runPaymentReminders(org.id, now)) === 0)
  await systemDb.organization.updateMany({ where: { id: org.id }, data: { paymentRemindersEnabled: false } })
  const inv2 = await systemDb.invoice.create({ data: { organizationId: org.id, customerId: optIn.id, invoiceNumber: 2, status: "SENT", issueDate: new Date(now.getTime() - 40 * 86_400_000), dueDate: new Date(now.getTime() - 10 * 86_400_000), periodStart: new Date(), periodEnd: new Date(), currency: "USD", subtotal: "50.00", taxTotal: "0", total: "50.00" }, select: { id: true } })
  check("disabled → no reminders", (await runPaymentReminders(org.id, now)) === 0)
  void inv; void inv2

  console.log("\nTwo-way messaging:")
  await postStaffMessage(org.id, optIn.id, mgr.id, "Hi! Just confirming tonight's visit.")
  await portalPostMessage(org.id, optIn.id, null, "Thanks — see you then.")
  const thread = await listCustomerMessages(org.id, optIn.id)
  check("both messages in one thread, ordered", thread.length === 2 && thread[0].sender === "STAFF" && thread[1].sender === "CUSTOMER")
  check("staff send emailed the customer (CUSTOMER_MESSAGE logged)", (await logs(org.id, "CUSTOMER_MESSAGE")) === 1)
  check("unread-from-customer count reflects the portal reply", (await countUnreadFromCustomers(org.id)) === 1)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL CUSTOMER-COMMS CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
