// Demo sandbox verification. Proves: the demo seed populates a realistic,
// live-dated org; demo orgs are excluded from the cross-org crons; per-IP rate
// limiting and reseed work; and the purge deletes expired demo orgs (one
// failure never blocks the rest).
//
// Usage: DATABASE_URL=... tsx scripts/verify-demo.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createDemoOrg, purgeExpiredDemoOrgs, DemoLimitError } from "../src/lib/demo/provision"
import { generatePeriodInvoicesAllOrgs } from "../src/lib/data/period-invoicing"
import { listUncoveredShifts } from "../src/lib/data/coverage"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  console.log("Seed produces a realistic, live-dated, non-empty org (even mix):")
  const d = await createDemoOrg("1.1.1.1", 2)
  const orgId = d.orgId
  const org = await systemDb.organization.findUniqueOrThrow({ where: { id: orgId } })
  check("org is flagged isDemo with a future expiry + ip hash", org.isDemo && !!org.demoExpiresAt && org.demoExpiresAt > new Date() && !!org.demoIpHash)
  check("owner identity returned for the session", !!d.owner.id && !!d.owner.email && !!d.owner.name)

  const count = (m: string, where: object = {}) => (systemDb as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[m].count({ where: { organizationId: orgId, ...where } })
  const users = await count("user", { role: { not: "CLIENT" } }) // staff only; a portal CLIENT invitee is separate
  const customers = await count("customer")
  const jobs = await count("job")
  const completed = await count("job", { status: "COMPLETED" })
  const upcoming = await count("job", { status: { in: ["ASSIGNED", "IN_PROGRESS"] } })
  const invSent = await count("invoice", { status: "SENT" })
  const invPartial = await count("invoice", { status: "PARTIALLY_PAID" })
  const failInsp = await count("inspection", { outcome: "FAIL" })
  const contracts = await count("contract")
  const photos = await count("jobPhoto")
  check("staff: 11 users (owner, manager, 2 sup, 7 cleaners)", users === 11, `users=${users}`)
  check("customers seeded", customers >= 4, `customers=${customers}`)
  check("calendar populated: completed AND upcoming jobs", completed > 0 && upcoming > 0, `done=${completed} upcoming=${upcoming}`)
  check("invoices: at least one SENT and one PARTIALLY_PAID", invSent > 0 && invPartial > 0, `sent=${invSent} partial=${invPartial}`)
  check("at least one critical inspection FAILURE", failInsp >= 1, `fail=${failInsp}`)
  check("commercial contracts with values", contracts >= 1, `contracts=${contracts}`)
  check("proof photos seeded (placeholder)", photos > 0, `photos=${photos}`)
  const jobDates = await systemDb.job.findMany({ where: { organizationId: orgId }, select: { scheduledStart: true }, take: 100 })
  const nowY = new Date().getUTCFullYear()
  check("jobs are dated around now (this year)", jobDates.every((j) => j.scheduledStart.getUTCFullYear() === nowY))

  console.log("Every previously-empty screen is now populated (no empty admin screen):")
  const now2 = new Date()
  const in30 = new Date(now2.getTime() + 30 * 86_400_000)
  const in60 = new Date(now2.getTime() + 60 * 86_400_000)
  check("Leads — multiple statuses", (await count("lead")) >= 4)
  check("Estimates — DRAFT, SENT, ACCEPTED", (await count("estimate", { status: "DRAFT" })) >= 1 && (await count("estimate", { status: "SENT" })) >= 1 && (await count("estimate", { status: "ACCEPTED" })) >= 1)
  check("bid worksheet saved on an estimate", (await count("estimate", { bidWorksheet: { not: null } })) >= 1)
  check("a contract expiring within the 60-day warning window", (await count("contract", { status: "ACTIVE", endDate: { gt: now2, lte: in60 } })) >= 1)
  check("Assets with maintenance history", (await count("asset")) >= 2 && (await systemDb.assetMaintenance.count({ where: { asset: { organizationId: orgId } } })) >= 1)
  const sup = await systemDb.supply.findMany({ where: { organizationId: orgId }, select: { currentStock: true, reorderThreshold: true } })
  check("Supplies incl. at least one below reorder threshold", sup.length >= 3 && sup.some((s) => Number(s.currentStock) < Number(s.reorderThreshold)), `low=${sup.filter((s) => Number(s.currentStock) < Number(s.reorderThreshold)).length}`)
  check("Supply usage recorded against jobs (→ profitability supplies)", (await count("supplyUsage")) > 0)
  const expiring = await count("credential", { status: "ACTIVE", expiryDate: { gt: now2, lte: in30 } })
  const expired = await count("credential", { status: "ACTIVE", expiryDate: { lt: now2 } })
  check("Credentials — one expiring soon AND one expired", expiring >= 1 && expired >= 1, `expiring=${expiring} expired=${expired}`)
  const access = await count("accessItem")
  const codes = await count("accessItem", { secretCiphertext: { not: null } })
  check("Access items (key/fob/badge) with NO encrypted codes", access >= 3 && codes === 0, `items=${access} codes=${codes}`)
  check("Cleaner availability + pending time-off", (await count("availability")) >= 1 && (await count("timeOffRequest", { status: "PENDING" })) >= 1)
  check("at least one uncovered shift in next 48h", (await listUncoveredShifts(orgId, { hoursAhead: 48 })).length >= 1)
  check("Export history", (await count("exportRun")) >= 2)
  check("Portal invite present", (await count("portalInvite")) >= 1)
  for (const st of ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID"]) check(`Invoice status present: ${st}`, (await count("invoice", { status: st })) >= 1)
  check("an overdue invoice (outstanding, past due)", (await count("invoice", { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: now2 } })) >= 1)
  check("both billing modes present (per-job + flat-period)", (await count("servicePlan", { billingMode: "PER_JOB" })) >= 1 && (await count("servicePlan", { billingMode: "FLAT_PERIOD" })) >= 1)

  console.log("Demo orgs are excluded from cross-org crons:")
  const periodResults = await generatePeriodInvoicesAllOrgs()
  check("period-invoicing all-orgs skips the demo org", !periodResults.some((r) => r.orgId === orgId))

  console.log("Per-IP rate limiting:")
  await createDemoOrg("9.9.9.9", 1)
  await createDemoOrg("9.9.9.9", 1)
  await createDemoOrg("9.9.9.9", 1)
  const err = await threw(() => createDemoOrg("9.9.9.9", 1)) // 4th within the hour
  check("4th demo from one IP within the hour is rate-limited", err instanceof DemoLimitError && (err as DemoLimitError).code === "rate_limit")

  console.log("Reseed replaces the visitor's org (limits skipped):")
  const re = await createDemoOrg("1.1.1.1", 0, { replaceOrgId: orgId })
  check("old demo org is gone after reseed", (await systemDb.organization.count({ where: { id: orgId } })) === 0)
  check("new demo org exists and is a demo", (await systemDb.organization.count({ where: { id: re.orgId, isDemo: true } })) === 1)

  console.log("Purge deletes expired demo orgs; a healthy org is untouched:")
  // Expire two demo orgs; leave one active.
  const expired1 = await createDemoOrg("2.2.2.2", 3)
  const expired2 = await createDemoOrg("3.3.3.3", 3)
  await systemDb.organization.updateMany({ where: { id: { in: [expired1.orgId, expired2.orgId] } }, data: { demoExpiresAt: new Date(Date.now() - 1000) } })
  const res = await purgeExpiredDemoOrgs()
  check("purge removed the expired orgs", res.purged >= 2 && res.failed === 0, `purged=${res.purged} failed=${res.failed}`)
  check("expired orgs are gone", (await systemDb.organization.count({ where: { id: { in: [expired1.orgId, expired2.orgId] } } })) === 0)
  check("the still-active demo org survives purge", (await systemDb.organization.count({ where: { id: re.orgId } })) === 1)

  // Cleanup any demo orgs this run created.
  await systemDb.organization.deleteMany({ where: { isDemo: true } })
  console.log(`\n${failures === 0 ? "ALL DEMO CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
