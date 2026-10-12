// Phase 35 integration verification: SMS issue intake.
//  - sender identified as employee / customer / unknown by phone
//  - employee text → issue with that reporter; customer → external w/ name;
//    unknown → flagged (not rejected) into the fallback inbox org
//  - unknown + no fallback on a multi-org deployment → not filed (can't attribute)
//  - routes through Phase 31 (source "SMS"); Twilio retries (same SID) dedupe
//  - Twilio signature verification proven (reject without token / accept valid)
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase35-sms.ts  (after migrate)

import { createHmac } from "node:crypto"
import { systemDb } from "../src/lib/org-db"
import { identifySmsSender, intakeSmsIssue, normalizePhone } from "../src/lib/data/sms-intake"
import { createRoutingRule } from "../src/lib/data/issue-routing"
import { getIssue } from "../src/lib/data/issues"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "SMS Co", slug: `sm-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const admin = await systemDb.user.create({ data: { organizationId: org.id, name: "Admin", email: `a-${stamp}@t.co`, password: "x", role: "ADMIN" } })
  const triage = await systemDb.user.create({ data: { organizationId: org.id, name: "Tanya Triage", email: `t-${stamp}@t.co`, password: "x", role: "SUPERVISOR" } })
  const emp = await systemDb.user.create({ data: { organizationId: org.id, name: "Ed Employee", email: `e-${stamp}@t.co`, password: "x", role: "CLEANER", phone: "(313) 555-1234" } })
  const cust = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme Corp", phone: "313-555-9876" } })
  // A second org with no matching phones — so an unknown number is genuinely unattributable.
  const org2 = await systemDb.organization.create({ data: { name: "Other Co", slug: `o2-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })

  await createRoutingRule(org.id, admin.id, { name: "SMS → triage", priority: 10, isActive: true, category: null, severity: null, source: "SMS", serviceLocationId: null, assignToId: triage.id })

  console.log("Phone normalization:")
  check("formats normalize to last 10 digits", normalizePhone("+1 (313) 555-1234") === "3135551234")

  console.log("\nSender identification:")
  check("employee phone → employee", (await identifySmsSender("+13135551234")).kind === "employee")
  check("customer phone → customer", (await identifySmsSender("+13135559876")).kind === "customer")
  check("unrecognized → unknown", (await identifySmsSender("+15005550000")).kind === "unknown")

  console.log("\nIntake + Phase 31 routing:")
  const r1 = await intakeSmsIssue({ from: "+13135551234", body: "Spill in hallway", messageSid: "SM1" })
  check("employee text filed with a reference", r1.filed && !!r1.reference)
  // Fetched by reportedById filter → reporter identity already proven; assert source + routing.
  const i1 = r1.filed ? await getIssue(org.id, (await systemDb.issue.findFirstOrThrow({ where: { organizationId: org.id, source: "SMS", reportedById: emp.id }, select: { id: true } })).id) : null
  check("employee issue: source SMS, reporter = employee, routed via SMS rule", i1?.source === "SMS" && i1?.assignedTo?.id === triage.id)

  const r2 = await intakeSmsIssue({ from: "+13135559876", body: "Trash overflowing", messageSid: "SM2" })
  const i2 = await systemDb.issue.findFirst({ where: { organizationId: org.id, source: "SMS", reportedById: null, externalReporter: { contains: "Acme" } }, select: { reportedById: true, externalReporter: true } })
  check("customer text → external reporter w/ name, no internal reporter", r2.filed && i2?.reportedById === null && (i2?.externalReporter ?? "").includes("Acme Corp"))

  console.log("\nUnknown sender is flagged, not rejected:")
  const rUnknownNoOrg = await intakeSmsIssue({ from: "+15005550000", body: "who am I", messageSid: "SM3" })
  check("unknown + no fallback (multi-org) → not filed", !rUnknownNoOrg.filed && rUnknownNoOrg.reason === "no_org")
  const rUnknownInbox = await intakeSmsIssue({ from: "+15005550000", body: "leaky faucet", messageSid: "SM4" }, org.id)
  check("unknown + fallback inbox → filed and flagged (not rejected)", rUnknownInbox.filed === true && rUnknownInbox.sender === "unknown")
  const iU = await systemDb.issue.findFirst({ where: { organizationId: org.id, source: "SMS", externalReporter: { contains: "Unknown sender" } }, select: { id: true } })
  check("unknown issue flagged as 'Unknown sender'", !!iU)

  console.log("\nTwilio retry dedupe (same MessageSid):")
  const before = await systemDb.issue.count({ where: { organizationId: org.id, source: "SMS" } })
  const retry = await intakeSmsIssue({ from: "+13135551234", body: "Spill in hallway", messageSid: "SM1" })
  check("retry of SM1 is a no-op duplicate", !retry.filed && retry.reason === "duplicate")
  check("no second issue created on retry", (await systemDb.issue.count({ where: { organizationId: org.id, source: "SMS" } })) === before)

  console.log("\nTwilio signature verification:")
  const { verifyTwilioSignature } = await import("../src/lib/sms")
  const url = "https://app.example.com/api/public/sms"
  const params = { From: "+13135551234", Body: "hi", To: "+15550000000" }
  const token = "test-token-xyz"
  process.env.TWILIO_AUTH_TOKEN = token
  const data = Object.keys(params).sort().reduce((a, k) => a + k + (params as Record<string, string>)[k], url)
  const good = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64")
  check("valid signature accepted", verifyTwilioSignature(url, params, good) === true)
  check("tampered signature rejected", verifyTwilioSignature(url, params, good.slice(0, -2) + "xx") === false)
  check("missing signature rejected", verifyTwilioSignature(url, params, null) === false)
  delete process.env.TWILIO_AUTH_TOKEN
  check("no auth token → reject by default", verifyTwilioSignature(url, params, good) === false)

  await systemDb.organization.delete({ where: { id: org.id } }).catch(() => {})
  await systemDb.organization.delete({ where: { id: org2.id } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL SMS CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
