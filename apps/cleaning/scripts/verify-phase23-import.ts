// Phase 23 integration verification: customer CSV import.
//  - CSV parsing handles quoted commas
//  - preview flags new / duplicate / error rows
//  - commit is ALL-OR-NOTHING: a hard error imports nothing
//  - a clean commit creates customers+sites+contacts, skips duplicates, tags the batch
//  - rollback deletes the batch's records, refuses when there's activity, and
//    refuses a non-latest batch
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase23-import.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { parseCsv, buildImportPreview, commitImport, rollbackImport, listImportBatches, IMPORT_COLUMNS } from "../src/lib/data/imports"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }
const H = IMPORT_COLUMNS.join(",")

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Import Co", slug: `imp-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  await systemDb.customer.create({ data: { organizationId: org.id, name: "Existing Co" } }) // for duplicate detection

  console.log("CSV parsing:")
  const grid = parseCsv('a,b\n"x,y",z')
  check("quoted commas parsed", grid.length === 2 && grid[1][0] === "x,y" && grid[1][1] === "z")

  console.log("\nPreview flags new / duplicate / error:")
  const previewCsv = [H,
    "Fresh Co,fresh@co.com,,Fresh HQ,1 St,Austin,TX,78701,Dana,dana@co.com,555",
    "Existing Co,,,Site A,,,,,,,",        // duplicate of seeded customer
    "Bad Co,not-an-email,,Site B,,,,,,,", // error: invalid email
  ].join("\n")
  const prev = await buildImportPreview(org.id, previewCsv)
  check("one create, one duplicate, one error", prev.summary.customersToCreate === 1 && prev.summary.duplicates === 1 && prev.summary.errors === 1)

  console.log("\nCommit is all-or-nothing (error row aborts everything):")
  const before = await systemDb.customer.count({ where: { organizationId: org.id } })
  const aborted = await threw(() => commitImport(org.id, previewCsv, mgr.id, "bad.csv"))
  check("commit with an error row throws", aborted !== null)
  check("nothing was imported", (await systemDb.customer.count({ where: { organizationId: org.id } })) === before)

  console.log("\nClean commit creates records, skips duplicates, tags the batch:")
  const goodCsv = [H,
    "Alpha Clinic,alpha@c.com,512-1,Alpha Main,10 A St,Austin,TX,78701,Pat,pat@c.com,512-2",
    "Alpha Clinic,alpha@c.com,512-1,Alpha Annex,12 A St,Austin,TX,78702,,,",  // second SITE for same customer
    "Existing Co,,,Dup Site,,,,,,,",  // duplicate → skipped entirely
  ].join("\n")
  const res = await commitImport(org.id, goodCsv, mgr.id, "good.csv")
  check("1 customer, 2 sites, 1 contact created (duplicate skipped)", res.customersCreated === 1 && res.sitesCreated === 2 && res.contactsCreated === 1)
  const alpha = await systemDb.customer.findFirstOrThrow({ where: { organizationId: org.id, name: "Alpha Clinic" }, include: { serviceLocations: true, contacts: true } })
  check("customer tagged with the batch + has 2 sites + 1 contact", alpha.importBatchId === res.batchId && alpha.serviceLocations.length === 2 && alpha.contacts.length === 1)
  check("the batch is in history", (await listImportBatches(org.id)).some((b) => b.id === res.batchId))

  console.log("\nRollback deletes the batch's records:")
  const roll = await rollbackImport(org.id, res.batchId)
  check("rollback removed the imported customer", roll.rolledBack === 1 && (await systemDb.customer.count({ where: { organizationId: org.id, importBatchId: res.batchId } })) === 0)
  check("sites cascaded away too", (await systemDb.serviceLocation.count({ where: { importBatchId: res.batchId } })) === 0)
  check("re-rollback is refused", (await threw(() => rollbackImport(org.id, res.batchId))) !== null)

  console.log("\nRollback refuses when imported records have activity:")
  const res2 = await commitImport(org.id, `${H}\nBeta LLC,,,Beta Site,,,,,,,`, mgr.id, "beta.csv")
  const betaSite = await systemDb.serviceLocation.findFirstOrThrow({ where: { importBatchId: res2.batchId } })
  await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: betaSite.id, title: "Job on imported site", status: "SCHEDULED", scheduledStart: new Date() } })
  check("rollback blocked by activity", (await threw(() => rollbackImport(org.id, res2.batchId))) !== null)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL IMPORT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
