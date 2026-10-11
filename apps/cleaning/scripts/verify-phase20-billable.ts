// Phase 20 integration verification: billable one-time & extra work.
//  - a MANUAL job with its own rate is invoiced; one WITHOUT a rate is excluded
//    and reported by name (never silently dropped)
//  - an approved change order flows onto the invoice as a DISTINCT line, and is
//    not billed twice (idempotent claim)
//  - a work order converts atomically to a scheduled billable job (one-shot)
//  - an issue converts to a work order (one per issue)
//  - portal + manager change-order decisions both work; cross-customer blocked
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase20-billable.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { generateInvoice } from "../src/lib/data/invoices"
import { convertWorkOrderToJob, convertIssueToWorkOrder, createWorkOrder } from "../src/lib/data/work-orders"
import { createChangeOrder, recordChangeOrderDecision, portalDecideChangeOrder } from "../src/lib/data/change-orders"

let failures = 0
function check(name: string, ok: boolean, detail = "") { console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Billable Co", slug: `bill-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme", paymentTerms: "DUE_ON_RECEIPT" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" } })
  const when = new Date("2026-06-15T12:00:00.000Z")

  console.log("Billable vs rate-less manual jobs:")
  const billable = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: null, title: "Strip & wax", status: "COMPLETED", scheduledStart: when, actualEnd: when, billingType: "FLAT_PER_JOB", rate: "450.00", currency: "USD" }, select: { id: true } })
  const rateless = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: null, title: "Favor — no charge", status: "COMPLETED", scheduledStart: when, actualEnd: when }, select: { id: true } })

  // A pending-then-approved billable extra on the billable job.
  const extra = await createChangeOrder(org.id, { jobId: billable.id, description: "Extra: pressure-wash entry", amount: "120.00" }, mgr.id)
  const decided = await recordChangeOrderDecision(org.id, extra.id, "APPROVED", mgr.id)
  check("manager approval records actor + not-portal", decided?.status === "APPROVED" && decided?.approvedByUserId === mgr.id && decided?.approvedByPortal === false)

  const res = await generateInvoice(org.id, { customerId: customer.id, periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  check("invoice created", res.created === true)
  if (res.created) {
    const lines = await systemDb.invoiceLine.findMany({ where: { invoiceId: res.invoiceId }, orderBy: { amount: "desc" } })
    const jobLine = lines.find((l) => l.activeJobId === billable.id)
    const coLine = lines.find((l) => l.activeChangeOrderId === extra.id)
    check("billable manual job is on the invoice at its rate", !!jobLine && jobLine.amount.toFixed(2) === "450.00")
    check("approved extra is a DISTINCT line at its amount", !!coLine && coLine.amount.toFixed(2) === "120.00" && coLine.id !== jobLine?.id)
    check("invoice total = job + extra", res.total === "570.00", `total=${res.total}`)
  }
  check("rate-less manual job EXCLUDED and reported by name", res.excluded.some((e) => e.jobId === rateless.id && /no billing rate/i.test(e.reason)))

  console.log("\nNo double-billing on re-generate:")
  const res2 = await generateInvoice(org.id, { customerId: customer.id, periodStart: "2026-06-01", periodEnd: "2026-06-30" })
  const coLineCount = await systemDb.invoiceLine.count({ where: { activeChangeOrderId: extra.id } })
  check("the extra is billed exactly once across regenerations", coLineCount === 1, `lines=${coLineCount}`)
  check("second generate finds nothing new billable", res2.created === false)

  console.log("\nWork order → scheduled billable job (atomic, one-shot):")
  const wo = await createWorkOrder(org.id, { customerId: customer.id, serviceLocationId: site.id, type: "EMERGENCY", description: "Flood response — extract & dry", quotedAmount: "1500.00" }, mgr.id)
  const { jobId } = await convertWorkOrderToJob(org.id, wo.id, { date: "2026-06-20", startTime: "08:00" })
  const woJob = await systemDb.job.findUniqueOrThrow({ where: { id: jobId } })
  const woAfter = await systemDb.workOrder.findUniqueOrThrow({ where: { id: wo.id } })
  check("job created billable at the quoted amount", woJob.rate?.toFixed(2) === "1500.00" && woJob.servicePlanId === null && woJob.billingType === "FLAT_PER_JOB")
  check("work order links the job and is marked SCHEDULED", woAfter.convertedJobId === jobId && woAfter.status === "SCHEDULED")
  check("re-converting a work order is refused", (await threw(() => convertWorkOrderToJob(org.id, wo.id, { date: "2026-06-21", startTime: "08:00" }))) !== null)

  console.log("\nIssue → work order (one per issue):")
  const issue = await systemDb.issue.create({ data: { organizationId: org.id, serviceLocationId: site.id, reportedById: mgr.id, description: "Carpet stained after event — needs deep clean", category: "QUALITY" }, select: { id: true } })
  const woFromIssue = await convertIssueToWorkOrder(org.id, issue.id, { type: "DEEP_CLEAN", quotedAmount: "300.00" }, mgr.id)
  check("work order created from the issue", woFromIssue.issueId === issue.id && woFromIssue.customerId === customer.id && woFromIssue.status === "QUOTED")
  check("converting the same issue again is refused", (await threw(() => convertIssueToWorkOrder(org.id, issue.id, {}, mgr.id))) !== null)

  console.log("\nPortal approval path + cross-customer block:")
  const extra2 = await createChangeOrder(org.id, { jobId: billable.id, description: "Extra: window interiors", amount: "80.00" }, mgr.id)
  const portalRes = await portalDecideChangeOrder(org.id, customer.id, extra2.id, "APPROVED")
  check("portal approval marks approvedByPortal", portalRes?.status === "APPROVED")
  const reloaded = await systemDb.changeOrder.findUniqueOrThrow({ where: { id: extra2.id } })
  check("portal approval flag persisted", reloaded.approvedByPortal === true && reloaded.approvedByUserId === null)
  const otherCustomer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Other" }, select: { id: true } })
  const extra3 = await createChangeOrder(org.id, { jobId: billable.id, description: "Extra", amount: "10.00" }, mgr.id)
  check("a different customer can't approve someone else's extra", (await threw(() => portalDecideChangeOrder(org.id, otherCustomer.id, extra3.id, "APPROVED"))) !== null)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL BILLABLE-WORK CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
