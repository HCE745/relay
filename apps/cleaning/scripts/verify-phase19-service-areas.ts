// Phase 19 integration verification. Focus: service-area evaluation (ZIP match;
// radius areas never false-flag; no areas = serviceable); do-not-serve exclusions
// WARN (never block) and are surfaced with a reason; every exclusion CRUD writes
// an AuditEvent with actor + reason; quote intake / online booking / customer
// creation all check; and online booking never reveals an exclusion — out-of-area
// is neutral, excluded submissions are accepted and flagged for staff only.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase19-service-areas.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { evaluateIntake } from "../src/lib/data/intake-eval"
import {
  createServiceArea, deleteServiceArea, createExcludedAddress, createExcludedContact, createExcludedZone,
  updateExcludedContact, deleteExcludedZone,
} from "../src/lib/data/service-areas"
import { createQuoteRequest, createPublicQuote } from "../src/lib/data/quote-requests"
import { createCustomer } from "../src/lib/data/customers"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
const auditCount = (orgId: string, entityType: string, entityId: string) =>
  systemDb.auditEvent.count({ where: { organizationId: orgId, entityType, entityId } })

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Area Co", slug: `a-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })

  console.log("Service area evaluation:")
  const inArea = await evaluateIntake(org.id, { postalCode: "78701" })
  check("no areas defined → serviceable (not outside)", inArea.outsideServiceArea === false)
  await createServiceArea(org.id, { name: "Central", zipCodes: ["78701", "78702"], officeLabel: "HQ" })
  const matched = await evaluateIntake(org.id, { postalCode: "78701" })
  check("ZIP inside an area → not outside", matched.outsideServiceArea === false)
  const outside = await evaluateIntake(org.id, { postalCode: "99999" })
  check("ZIP matching no area → flagged outside", outside.outsideServiceArea === true)
  const noZip = await evaluateIntake(org.id, { city: "Nowhere" })
  check("no postal code supplied → not flagged outside (can't evaluate)", noZip.outsideServiceArea === false)
  // A radius-only area must never force an address outside (no geocoder), and
  // because it can't be evaluated it suppresses ZIP-based outside-flagging too —
  // we never turn away an address a radius area might actually cover.
  const radiusArea = await createServiceArea(org.id, { name: "Radius", zipCodes: [], radiusMiles: 30, centerLat: 30.26, centerLng: -97.74 })
  const withRadius = await evaluateIntake(org.id, { postalCode: "99999" })
  check("a radius area present → outside is NOT asserted", withRadius.outsideServiceArea === false)
  await deleteServiceArea(org.id, radiusArea.id) // remaining tests use ZIP areas only

  console.log("Exclusions WARN + are surfaced with reason + audited on every CRUD:")
  const exAddr = await createExcludedAddress(org.id, mgr.id, { addressLine1: "4200 Red Zone Rd", postalCode: "78701", reason: "SAFETY_INCIDENT", note: "Dog" })
  check("address exclusion create audited", (await auditCount(org.id, "ExcludedAddress", exAddr.id)) === 1)
  const exContact = await createExcludedContact(org.id, mgr.id, { phone: "512-555-0147", reason: "NON_PAYMENT" })
  check("contact exclusion create audited", (await auditCount(org.id, "ExcludedContact", exContact.id)) === 1)
  const exZone = await createExcludedZone(org.id, mgr.id, { value: "78704", reason: "NO_CREW_COVERAGE" })
  check("zone exclusion create audited", (await auditCount(org.id, "ExcludedZone", exZone.id)) === 1)

  const addrHit = await evaluateIntake(org.id, { addressLine1: "4200 Red Zone Rd", postalCode: "78701" })
  check("excluded address surfaced with reason", addrHit.exclusions.some((e) => e.kind === "address" && e.reason === "SAFETY_INCIDENT"))
  const contactHit = await evaluateIntake(org.id, { contactPhone: "(512) 555-0147" })
  check("excluded contact matched by normalized phone", contactHit.exclusions.some((e) => e.kind === "contact" && e.reason === "NON_PAYMENT"))
  const zoneHit = await evaluateIntake(org.id, { postalCode: "78704" })
  check("excluded zone matched by ZIP", zoneHit.exclusions.some((e) => e.kind === "zone"))

  await updateExcludedContact(org.id, mgr.id, exContact.id, { note: "Charged back twice" })
  check("exclusion edit audited", (await auditCount(org.id, "ExcludedContact", exContact.id)) === 2)
  await deleteExcludedZone(org.id, mgr.id, exZone.id)
  check("exclusion delete audited", (await auditCount(org.id, "ExcludedZone", exZone.id)) === 2)
  check("zone exclusion actually gone", (await systemDb.excludedZone.count({ where: { id: exZone.id } })) === 0)

  console.log("Quote intake (staff): stores flag + logs an acknowledgement:")
  const q = await createQuoteRequest(org.id, { source: "PHONE", contactName: "Flagged Caller", contactPhone: "512-555-0147", propertyType: "RESIDENTIAL" }, mgr.id)
  check("intake returned exclusions", q.exclusions.length >= 1)
  const qRow = await systemDb.quoteRequest.findUniqueOrThrow({ where: { id: q.id } })
  check("quote persisted excluded + reason", qRow.excluded === true && qRow.exclusionReason === "NON_PAYMENT")
  check("staff override acknowledgement audited", (await systemDb.auditEvent.count({ where: { organizationId: org.id, entityType: "QuoteRequest", entityId: q.id, action: "intake_flag_acknowledged" } })) === 1)

  console.log("Online booking: out-of-area neutral; exclusion NEVER revealed:")
  const oob = await createPublicQuote(org.id, { contactName: "Far Away", postalCode: "99999", propertyType: "RESIDENTIAL" }, "ip-x")
  check("outside-area public booking returns neutral out_of_area", oob.accepted === false && "reason" in oob && oob.reason === "out_of_area")
  const exBooking = await createPublicQuote(org.id, { contactName: "Excluded Person", contactPhone: "512-555-0147", postalCode: "78701", propertyType: "RESIDENTIAL" }, "ip-y")
  check("excluded public booking is ACCEPTED (never revealed)", exBooking.accepted === true)
  const exBookingRow = exBooking.accepted ? await systemDb.quoteRequest.findUniqueOrThrow({ where: { id: exBooking.id } }) : null
  check("excluded public booking flagged for staff only", exBookingRow?.excluded === true && exBookingRow?.exclusionReason === "NON_PAYMENT")

  console.log("Customer creation checks exclusions + surfaces a flag:")
  const cust = await createCustomer(org.id, { name: "Repeat Offender", phone: "512-555-0147", paymentTerms: "DUE_ON_RECEIPT" }, mgr.id)
  check("customer created (WARN, not blocked)", !!cust.id)
  check("customer create surfaced exclusion flag", cust.intakeExclusions.some((e) => e.reason === "NON_PAYMENT"))
  check("customer override acknowledgement audited", (await systemDb.auditEvent.count({ where: { organizationId: org.id, entityType: "Customer", entityId: cust.id, action: "intake_flag_acknowledged" } })) === 1)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL SERVICE-AREA CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
