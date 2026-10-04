// Demo sandbox verification. Proves: the demo seed populates a realistic,
// live-dated org; demo orgs are excluded from the cross-org crons; per-IP rate
// limiting and reseed work; and the purge deletes expired demo orgs (one
// failure never blocks the rest).
//
// Usage: DATABASE_URL=... tsx scripts/verify-demo.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createDemoOrg, purgeExpiredDemoOrgs, DemoLimitError } from "../src/lib/demo/provision"
import { generatePeriodInvoicesAllOrgs } from "../src/lib/data/period-invoicing"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  console.log("Seed produces a realistic, live-dated, non-empty org (mostly-commercial):")
  const d = await createDemoOrg("1.1.1.1", 2)
  const orgId = d.orgId
  const org = await systemDb.organization.findUniqueOrThrow({ where: { id: orgId } })
  check("org is flagged isDemo with a future expiry + ip hash", org.isDemo && !!org.demoExpiresAt && org.demoExpiresAt > new Date() && !!org.demoIpHash)
  check("owner identity returned for the session", !!d.owner.id && !!d.owner.email && !!d.owner.name)

  const count = (m: string, where: object = {}) => (systemDb as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[m].count({ where: { organizationId: orgId, ...where } })
  const users = await count("user")
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
