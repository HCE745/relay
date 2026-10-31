// Phase 42 integration verification: automatic corrective work orders.
//  - a failed inspection auto-creates ONE non-billable corrective WO, linked to
//    the inspection, with a severity-derived due date (idempotent)
//  - resolve/verify split: the verifier must differ from the resolver
//  - re-inspection spawns a fresh inspection on the same job + template
//  - criticalOnly rule: a non-critical-only failure creates nothing
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase42-corrective.ts  (after migrate)

import { systemDb, orgDb } from "../src/lib/org-db"
import { createInspectionFromJob, setInspectionItemResult, finalizeInspection, reinspectFromWorkOrder } from "../src/lib/scheduling/inspections"
import { resolveCorrectiveWorkOrder, verifyCorrectiveWorkOrder } from "../src/lib/data/work-orders"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>): Promise<boolean> { try { await fn(); return false } catch { return true } }

async function setup(orgId: string, staff: { sup: string }, criticalCreate: boolean) {
  const cust = await systemDb.customer.create({ data: { organizationId: orgId, name: "Acme" }, select: { id: true } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: orgId, customerId: cust.id, name: "HQ", timezone: "UTC" }, select: { id: true } })
  const job = await systemDb.job.create({ data: { organizationId: orgId, serviceLocationId: site.id, title: "Clean", status: "COMPLETED", plannedStart: new Date(), scheduledStart: new Date(), scheduledEnd: new Date(), actualEnd: new Date(), crewSize: 1, createdById: staff.sup }, select: { id: true } })
  const tpl = await systemDb.inspectionTemplate.create({
    data: {
      organizationId: orgId, name: "QC", passThreshold: 80,
      items: { create: [
        { label: "Critical item", points: 50, isCritical: criticalCreate, requirePhoto: false, sortOrder: 1 },
        { label: "Normal item", points: 50, isCritical: false, requirePhoto: false, sortOrder: 2 },
      ] },
    },
    select: { id: true },
  })
  return { jobId: job.id, templateId: tpl.id }
}

async function failAll(orgId: string, inspectionId: string) {
  const insp = await orgDb(orgId).inspection.findFirst({ where: { id: inspectionId }, include: { results: true } })
  for (const r of insp!.results) await setInspectionItemResult(orgId, inspectionId, r.id, { result: "FAIL" })
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "WO Co", slug: `wo-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC", autoCorrectiveWorkOrders: true, correctiveOnCriticalOnly: false, correctiveDueDaysCritical: 1, correctiveDueDaysStandard: 3 } })
  const sup = await systemDb.user.create({ data: { organizationId: org.id, name: "Sup A", email: `sa-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const sup2 = await systemDb.user.create({ data: { organizationId: org.id, name: "Sup B", email: `sb-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })

  console.log("Failed inspection → corrective work order:")
  const a = await setup(org.id, { sup: sup.id }, true)
  const insp = await createInspectionFromJob(org.id, a.jobId, sup.id, a.templateId)
  await failAll(org.id, insp.id)
  const fin = await finalizeInspection(org.id, insp.id, sup.id)
  check("inspection failed", fin.outcome === "FAIL")
  check("a corrective WO was created", !!fin.correctiveWorkOrderId)
  const wo = await orgDb(org.id).workOrder.findFirst({ where: { id: fin.correctiveWorkOrderId! } })
  check("it is corrective + non-billable", wo?.isCorrective === true && wo?.billable === false)
  check("linked to the inspection", wo?.inspectionId === insp.id)
  check("has a due date", !!wo?.dueAt)
  check("priority URGENT for a critical failure", wo?.priority === "URGENT")

  console.log("\nIdempotent — finalizing again makes no second WO:")
  await finalizeInspection(org.id, insp.id, sup.id)
  const count = await orgDb(org.id).workOrder.count({ where: { inspectionId: insp.id } })
  check("still exactly one corrective WO", count === 1)

  console.log("\nResolve/verify split (verifier must differ):")
  await resolveCorrectiveWorkOrder(org.id, wo!.id, sup.id)
  check("resolver recorded", (await orgDb(org.id).workOrder.findFirst({ where: { id: wo!.id }, select: { resolvedById: true, status: true } }))?.status === "RESOLVED")
  check("same person cannot verify", await threw(() => verifyCorrectiveWorkOrder(org.id, wo!.id, sup.id)))
  const verified = await verifyCorrectiveWorkOrder(org.id, wo!.id, sup2.id)
  check("a different person verifies", verified?.status === "VERIFIED")

  console.log("\nRe-inspection from the corrective WO:")
  const reinsp = await reinspectFromWorkOrder(org.id, wo!.id, sup.id)
  check("a fresh DRAFT inspection on the same job", reinsp.status === "DRAFT" && reinsp.jobId === a.jobId)

  console.log("\ncriticalOnly: a non-critical-only failure creates nothing:")
  await systemDb.organization.update({ where: { id: org.id }, data: { correctiveOnCriticalOnly: true } })
  const b = await setup(org.id, { sup: sup.id }, true)
  const insp2 = await createInspectionFromJob(org.id, b.jobId, sup.id, b.templateId)
  // Pass the critical item, fail only the normal one → overall FAIL, no critical failure.
  const results2 = await orgDb(org.id).inspection.findFirst({ where: { id: insp2.id }, include: { results: true } })
  for (const r of results2!.results) await setInspectionItemResult(org.id, insp2.id, r.id, { result: r.isCritical ? "PASS" : "FAIL" })
  const fin2 = await finalizeInspection(org.id, insp2.id, sup.id)
  check("still a FAIL (below threshold)", fin2.outcome === "FAIL")
  check("no corrective WO (critical-only rule)", fin2.correctiveWorkOrderId === null)

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL CORRECTIVE CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
