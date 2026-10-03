// Phase 9 integration verification against a live database. Focus: FLAT_PERIOD
// plans bill one flat charge per period (regardless of visit count) and list
// covered visits as non-billable detail; those visits are claimed so they can't
// also be billed per-job; generation is idempotent per plan-period; the cron
// path drafts only for ENDED periods and never auto-sends; void releases the
// claim; per-job billing is unchanged.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase9-period-invoicing.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { generateInvoice, getInvoice, setInvoiceStatus } from "../src/lib/data/invoices"
import { generatePeriodInvoicesForOrg } from "../src/lib/data/period-invoicing"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Period Test", slug: `period-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })

  const mkCustomer = (name: string) => systemDb.customer.create({ data: { organizationId: org.id, name, paymentTerms: "NET_15" } })
  const mkSite = (customerId: string, name: string) =>
    systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId, name, timezone: "UTC" } })
  const mkFlatPlan = (siteId: string, name: string, amount: string, freq: "MONTHLY" | "QUARTERLY") =>
    systemDb.servicePlan.create({
      data: { organizationId: org.id, serviceLocationId: siteId, name, billingMode: "FLAT_PERIOD", periodAmount: amount, periodFrequency: freq },
    })
  const mkPerJobPlan = (siteId: string, name: string, rate: string) =>
    systemDb.servicePlan.create({
      data: { organizationId: org.id, serviceLocationId: siteId, name, billingMode: "PER_JOB", billingType: "FLAT_PER_JOB", rate },
    })
  const mkJob = (siteId: string, planId: string, title: string, day: string) =>
    systemDb.job.create({
      data: {
        organizationId: org.id, serviceLocationId: siteId, servicePlanId: planId, title, status: "COMPLETED",
        scheduledStart: new Date(`${day}T09:00:00Z`), actualEnd: new Date(`${day}T10:00:00Z`),
      },
    })
  const linesOf = async (invoiceId: string) => {
    const inv = await getInvoice(org.id, invoiceId)
    const lines = inv!.lines
    return {
      total: inv!.total.toString(),
      status: inv!.status,
      billable: lines.filter((l) => l.billable),
      detail: lines.filter((l) => !l.billable),
    }
  }

  console.log("FLAT_PERIOD bills one flat charge + lists covered visits as non-billable detail:")
  const c1 = await mkCustomer("Flat Co")
  const s1 = await mkSite(c1.id, "HQ")
  const p1 = await mkFlatPlan(s1.id, "Monthly Janitorial", "2000.00", "MONTHLY")
  await mkJob(s1.id, p1.id, "Visit 1", "2026-03-05")
  await mkJob(s1.id, p1.id, "Visit 2", "2026-03-12")
  await mkJob(s1.id, p1.id, "Visit 3", "2026-03-19")
  const g1 = await generateInvoice(org.id, { customerId: c1.id, periodStart: "2026-03-01", periodEnd: "2026-03-31" })
  check("invoice created", g1.created)
  if (g1.created) {
    const L = await linesOf(g1.invoiceId)
    check("exactly one billable line", L.billable.length === 1, `got ${L.billable.length}`)
    check("flat charge equals the period amount (visit count irrelevant)", L.billable[0]?.amount.toString() === "2000", L.billable[0]?.amount.toString())
    check("total is the flat amount, not 3× a visit rate", L.total === "2000")
    check("three covered visits listed as non-billable detail", L.detail.length === 3, `got ${L.detail.length}`)
    check("detail lines are amount 0", L.detail.every((d) => d.amount.toString() === "0"))
    check("status is DRAFT (never auto-sent)", L.status === "DRAFT")
  }

  console.log("Covered visits are claimed — can't be double-billed, and re-run is idempotent:")
  const claimed = await systemDb.invoiceLine.count({ where: { billable: false, activeJobId: { not: null }, invoice: { customerId: c1.id } } })
  check("covered visits hold an activeJobId claim", claimed === 3, `claimed=${claimed}`)
  const g1b = await generateInvoice(org.id, { customerId: c1.id, periodStart: "2026-03-01", periodEnd: "2026-03-31" })
  check("re-running the same period creates nothing (activePeriodKey)", !g1b.created, g1b.created ? "created again!" : g1b.reason)

  console.log("Mixed customer: per-job + flat on one invoice, totals add up:")
  const c2 = await mkCustomer("Mixed Co")
  const s2 = await mkSite(c2.id, "Plant")
  const pj = await mkPerJobPlan(s2.id, "Ad-hoc deep clean", "300.00")
  const fp = await mkFlatPlan(s2.id, "Monthly service", "1800.00", "MONTHLY")
  await mkJob(s2.id, pj.id, "Deep clean", "2026-03-10")
  await mkJob(s2.id, fp.id, "Flat visit A", "2026-03-08")
  await mkJob(s2.id, fp.id, "Flat visit B", "2026-03-22")
  const g2 = await generateInvoice(org.id, { customerId: c2.id, periodStart: "2026-03-01", periodEnd: "2026-03-31" })
  check("mixed invoice created", g2.created)
  if (g2.created) {
    const L = await linesOf(g2.invoiceId)
    check("two billable lines (one per-job + one flat)", L.billable.length === 2, `got ${L.billable.length}`)
    check("total = 300 per-job + 1800 flat = 2100", L.total === "2100", L.total)
    check("flat plan's two visits are non-billable detail", L.detail.length === 2, `got ${L.detail.length}`)
  }

  console.log("Cron path: drafts only ENDED periods, bills regardless of visits, idempotent:")
  const c3 = await mkCustomer("Cron Co")
  const s3 = await mkSite(c3.id, "Depot")
  await mkFlatPlan(s3.id, "Monthly guard", "1500.00", "MONTHLY") // no jobs at all
  // now = mid-March: February has ended, March has not.
  const now = new Date("2026-03-15T12:00:00Z")
  const r3 = await generatePeriodInvoicesForOrg(org.id, { now, windowDays: 20 })
  // Every customer with an active flat plan and an unbilled ended period (Feb)
  // gets a draft — here c1, c2 and c3 — so created is 3, not 1.
  check("cron drafted the ended period for every flat customer", r3.created === 3, `created=${r3.created}`)
  const cronInv = await systemDb.invoice.findFirst({ where: { customerId: c3.id }, include: { lines: true } })
  check("flat charge billed with zero visits (regardless of visit count)", !!cronInv && cronInv.lines.filter((l) => l.billable).length === 1)
  check("the ENDED period (February) was billed", cronInv?.lines[0]?.description.includes("February 2026") ?? false, cronInv?.lines[0]?.description)
  check("the not-yet-ended period (March) was NOT billed", !cronInv?.lines.some((l) => l.description.includes("March 2026")))
  check("cron invoice is DRAFT", cronInv?.status === "DRAFT")
  const r3b = await generatePeriodInvoicesForOrg(org.id, { now, windowDays: 20 })
  check("cron re-run is idempotent (nothing new)", r3b.created === 0, `created=${r3b.created}`)

  console.log("Void releases the period claim so it can be re-billed:")
  if (cronInv) {
    await setInvoiceStatus(org.id, cronInv.id, "VOID")
    const released = await systemDb.invoiceLine.count({ where: { invoiceId: cronInv.id, activePeriodKey: { not: null } } })
    check("voided invoice's activePeriodKey is cleared", released === 0, `still set=${released}`)
    const r3c = await generatePeriodInvoicesForOrg(org.id, { now, windowDays: 20 })
    check("the period can be re-billed after void", r3c.created === 1, `created=${r3c.created}`)
  }

  console.log("Quarterly flat billing bills once per quarter:")
  const c4 = await mkCustomer("Quarterly Co")
  const s4 = await mkSite(c4.id, "Tower")
  await mkFlatPlan(s4.id, "Quarterly service", "9000.00", "QUARTERLY")
  const g4 = await generateInvoice(org.id, { customerId: c4.id, periodStart: "2026-01-01", periodEnd: "2026-03-31" })
  check("quarterly invoice created", g4.created)
  if (g4.created) {
    const L = await linesOf(g4.invoiceId)
    check("one quarterly flat line", L.billable.length === 1, `got ${L.billable.length}`)
    check("labeled Q1 2026", L.billable[0]?.description.includes("Q1 2026") ?? false, L.billable[0]?.description)
    check("total is the quarterly amount", L.total === "9000", L.total)
  }

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL PERIOD-INVOICING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
