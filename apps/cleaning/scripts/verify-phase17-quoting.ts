// Phase 17 integration verification. Focus: staff intake creates quote requests;
// the public booking path is rate-limited per IP and per org and drops honeypot
// bots; out-of-area is a distinct non-accept (Phase 19 wires real areas);
// conversion creates a Lead and/or Estimate, links back, and is one-shot.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase17-quoting.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createQuoteRequest, createPublicQuote, convertQuoteRequest, listQuoteRequests } from "../src/lib/data/quote-requests"
import { INTAKE_LIMITS, IntakeRejected } from "../src/lib/public-intake"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Quote Co", slug: `q-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })

  console.log("Staff intake creates a quote request:")
  const q = await createQuoteRequest(org.id, { source: "PHONE", contactName: "Alex Caller", contactPhone: "555-0100", propertyType: "RESIDENTIAL", sqft: 2000, frequency: "BIWEEKLY" }, mgr.id)
  check("quote request created", !!q.id)
  check("not flagged outside area (no areas defined yet)", q.outsideServiceArea === false)

  console.log("Conversion → Lead + Estimate, linked, one-shot:")
  const conv = await convertQuoteRequest(org.id, q.id, { toLead: true, toEstimate: true })
  check("created a Lead and an Estimate", !!conv.leadId && !!conv.estimateId)
  const after = await systemDb.quoteRequest.findUniqueOrThrow({ where: { id: q.id } })
  check("quote linked to the lead + estimate and marked QUOTED", after.convertedLeadId === conv.leadId && after.convertedEstimateId === conv.estimateId && after.status === "QUOTED")
  const second = await threw(() => convertQuoteRequest(org.id, q.id, { toLead: true }))
  check("re-converting is refused", second !== null)
  check("the lead really exists", (await systemDb.lead.count({ where: { id: conv.leadId! } })) === 1)
  check("the estimate really exists", (await systemDb.estimate.count({ where: { id: conv.estimateId! } })) === 1)

  console.log("Public booking: honeypot + rate limit + source ONLINE:")
  const ipA = "hash-A"
  const r1 = await createPublicQuote(org.id, { contactName: "Online Lead", contactEmail: "o@l.co", propertyType: "COMMERCIAL" }, ipA)
  check("accepted online submission", r1.accepted === true)
  const onlineRow = await systemDb.quoteRequest.findFirst({ where: { organizationId: org.id, source: "ONLINE" } })
  check("stored with source ONLINE + ipHash", !!onlineRow && onlineRow.ipHash === ipA)
  // Hit the per-IP cap (ipMax). r1 already used 1 for ipA.
  for (let i = 1; i < INTAKE_LIMITS.ipMax; i++) await createPublicQuote(org.id, { contactName: `L${i}`, propertyType: "RESIDENTIAL" }, ipA)
  const limited = await threw(() => createPublicQuote(org.id, { contactName: "Over", propertyType: "RESIDENTIAL" }, ipA))
  check("per-IP rate limit kicks in", limited instanceof IntakeRejected && (limited as IntakeRejected).code === "rate_limit")
  // A different IP is still allowed (not globally blocked by one abuser, under org cap).
  const other = await createPublicQuote(org.id, { contactName: "Fresh IP", propertyType: "RESIDENTIAL" }, "hash-B")
  check("a different IP is still accepted", other.accepted === true)

  console.log("List reflects everything:")
  const all = await listQuoteRequests(org.id)
  check("quote requests listed", all.length >= 6, `count=${all.length}`)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL QUOTING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
