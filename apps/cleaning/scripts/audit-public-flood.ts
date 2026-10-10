// AUDIT / regression for the public-endpoint flood (Step 2.3). This is the same
// test that originally PROVED the rotating-X-Forwarded-For bypass; it now proves
// the bypass is CLOSED. It composes the REAL functions in the exact order the
// route uses them (see src/app/api/public/[slug]/quote/route.ts):
//   clientIpFromHeaders → enforceIpBurst (pre-DB) → [DB] createPublicQuote.
//
// Usage: DATABASE_URL=... tsx scripts/audit-public-flood.ts   (after migrate)

import { systemDb } from "../src/lib/org-db"
import { INTAKE_LIMITS, hashIp, IntakeRejected, clientIpFromHeaders } from "../src/lib/public-intake"
import { enforceIpBurst, enforceOrgBurst, resetRateLimiter, BURST_LIMITS } from "../src/lib/rate-limit"
import { createPublicQuote } from "../src/lib/data/quote-requests"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

type Outcome = "accepted" | "rejected_pre_db" | "rejected_db" | "out_of_area"

// Mirror the route exactly: per-IP burst runs BEFORE any DB work.
async function attempt(orgId: string, headers: Record<string, string>): Promise<Outcome> {
  const ip = clientIpFromHeaders(new Headers(headers))
  try {
    enforceIpBurst(ip) // PRE-DB
  } catch (e) {
    if (e instanceof IntakeRejected) return "rejected_pre_db"
    throw e
  }
  try {
    enforceOrgBurst(orgId)
    const r = await createPublicQuote(orgId, { contactName: "x", propertyType: "RESIDENTIAL" }, hashIp(ip))
    return r.accepted ? "accepted" : "out_of_area"
  } catch (e) {
    if (e instanceof IntakeRejected) return "rejected_db"
    throw e
  }
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Flood Co", slug: `flood-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  console.log(`IP burst capacity=${BURST_LIMITS.ip.capacity}, org burst=${BURST_LIMITS.org.capacity}, DB org ceiling=${INTAKE_LIMITS.orgMax}/hr\n`)

  // THE ORIGINAL ATTACK: attacker rotates the client-controlled x-forwarded-for
  // on every request. On Vercel the platform sets x-vercel-forwarded-for to the
  // real client IP (constant here) — which is what clientIpFromHeaders trusts.
  console.log("Rotating X-Forwarded-For (the bypass that used to let 20/20 through):")
  resetRateLimiter()
  let accepted = 0, preDbRejected = 0
  const attempts = 20
  for (let i = 0; i < attempts; i++) {
    const r = await attempt(org.id, { "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": `10.0.${i}.${i}` })
    if (r === "accepted") accepted++
    else if (r === "rejected_pre_db") preDbRejected++
  }
  check("rotating the header no longer bypasses the per-IP limit", accepted <= BURST_LIMITS.ip.capacity, `${accepted} accepted (cap ${BURST_LIMITS.ip.capacity}) vs 20 before`)
  check("excess requests are rejected PRE-DB (no Postgres work)", preDbRejected >= attempts - BURST_LIMITS.ip.capacity, `${preDbRejected} rejected before any DB call`)
  const rows = await systemDb.quoteRequest.count({ where: { organizationId: org.id } })
  check("rows persisted bounded by the IP burst, not the attempt count", rows === accepted && rows <= BURST_LIMITS.ip.capacity, `${rows} rows`)

  // A truly distributed attack (many DISTINCT real IPs) is bounded per org by
  // the org burst + the durable DB ceiling.
  console.log("\nDistributed attack (distinct trusted IPs) is bounded per org:")
  resetRateLimiter()
  await systemDb.quoteRequest.deleteMany({ where: { organizationId: org.id } })
  let orgAccepted = 0
  for (let i = 0; i < BURST_LIMITS.org.capacity + 20; i++) {
    const r = await attempt(org.id, { "x-vercel-forwarded-for": `198.51.${Math.floor(i / 256)}.${i % 256}` })
    if (r === "accepted") orgAccepted++
  }
  check("per-org burst caps a distributed flood", orgAccepted <= BURST_LIMITS.org.capacity, `${orgAccepted} accepted (org burst ${BURST_LIMITS.org.capacity})`)

  // Sanity: a single legitimate caller within burst still succeeds.
  console.log("\nLegitimate caller still works:")
  resetRateLimiter()
  await systemDb.quoteRequest.deleteMany({ where: { organizationId: org.id } })
  const good = await attempt(org.id, { "x-vercel-forwarded-for": "192.0.2.50" })
  check("a normal submission is accepted", good === "accepted")

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "BYPASS CLOSED — flood controls hold" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
