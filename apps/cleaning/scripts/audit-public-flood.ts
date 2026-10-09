// AUDIT (read-only): what actually stops an attacker flooding the public,
// unauthenticated online-quote endpoint? The route handler can't be imported
// here (it pulls in server-only via page-guards), so this replicates the
// route's EXACT ip-derivation (src/app/api/public/[slug]/quote/route.ts:24) and
// drives the same data path (createPublicQuote + hashIp). Proves:
//   A. Same-IP flooding trips the per-IP limit at ipMax.
//   B. Rotating the X-Forwarded-For header DEFEATS the per-IP limit — the IP
//      identity is attacker-controlled (route.ts reads it straight from the header).
//   C. The per-org row cap (orgMax) is the only backstop; it bounds rows but
//      every attempt still runs 2 COUNT queries + a capability lookup first.
//
// Usage: DATABASE_URL=... tsx scripts/audit-public-flood.ts   (after migrate)

import { systemDb } from "../src/lib/org-db"
import { INTAKE_LIMITS, hashIp, IntakeRejected } from "../src/lib/public-intake"
import { createPublicQuote } from "../src/lib/data/quote-requests"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

// EXACT copy of route.ts:23-24 — how the endpoint decides the caller's IP.
function ipFromHeaders(xForwardedFor: string | null, xRealIp: string | null) {
  const fwd = xForwardedFor
  return (fwd ? fwd.split(",")[0] : null)?.trim() || xRealIp || "0.0.0.0"
}

async function attempt(orgId: string, xff: string | null, name: string): Promise<"accepted" | "out_of_area" | "rejected"> {
  const ip = ipFromHeaders(xff, null)
  try {
    const r = await createPublicQuote(orgId, { contactName: name, propertyType: "RESIDENTIAL" }, hashIp(ip))
    return r.accepted ? "accepted" : "out_of_area"
  } catch (e) {
    if (e instanceof IntakeRejected) return "rejected"
    throw e
  }
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Flood Co", slug: `flood-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  console.log(`Limits in force: ipMax=${INTAKE_LIMITS.ipMax}/hr, orgMax=${INTAKE_LIMITS.orgMax}/hr\n`)

  console.log("A. Same IP → per-IP limit trips:")
  let sameRejected = 0
  for (let i = 0; i < INTAKE_LIMITS.ipMax + 3; i++) if ((await attempt(org.id, "203.0.113.9", `same-${i}`)) === "rejected") sameRejected++
  check("a single IP is throttled", sameRejected > 0, `${sameRejected} rejected of ${INTAKE_LIMITS.ipMax + 3}`)
  await systemDb.quoteRequest.deleteMany({ where: { organizationId: org.id } })

  console.log("\nB. Rotating X-Forwarded-For → per-IP limit DEFEATED:")
  let rotatedAccepted = 0
  for (let i = 0; i < INTAKE_LIMITS.ipMax * 4; i++) {
    if ((await attempt(org.id, `10.0.${Math.floor(i / 256)}.${i % 256}`, `rot-${i}`)) === "accepted") rotatedAccepted++
  }
  check("rotating the IP sails past the per-IP cap", rotatedAccepted > INTAKE_LIMITS.ipMax, `${rotatedAccepted} accepted vs per-IP cap of ${INTAKE_LIMITS.ipMax}`)
  await systemDb.quoteRequest.deleteMany({ where: { organizationId: org.id } })

  console.log("\nC. Per-org cap is the only backstop against a rotating-IP flood:")
  let orgAccepted = 0, orgRejected = 0
  for (let i = 0; i < INTAKE_LIMITS.orgMax + 10; i++) {
    const r = await attempt(org.id, `172.16.${Math.floor(i / 256)}.${i % 256}`, `cap-${i}`)
    if (r === "accepted") orgAccepted++; else if (r === "rejected") orgRejected++
  }
  check("org cap bounds rows written", orgAccepted <= INTAKE_LIMITS.orgMax, `${orgAccepted} rows written (cap ${INTAKE_LIMITS.orgMax})`)
  check("over-cap attempts rejected", orgRejected > 0, `${orgRejected} rejected`)
  const rows = await systemDb.quoteRequest.count({ where: { organizationId: org.id } })
  check("DB row growth bounded by org cap", rows <= INTAKE_LIMITS.orgMax, `${rows} rows persisted`)

  console.log("\n  NOTE: each attempt above (incl. the rejected ones) ran org.findUnique + a")
  console.log("  capability lookup + 2 COUNT queries before the limit decision. No pre-DB /")
  console.log("  edge throttle exists, so request-processing / DB-query load is NOT bounded —")
  console.log("  only persisted rows are. See src/lib/data/quote-requests.ts createPublicQuote.\n")

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(failures === 0 ? "AUDIT ASSERTIONS HELD (findings confirmed)" : `${failures} ASSERTION(S) UNEXPECTED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
