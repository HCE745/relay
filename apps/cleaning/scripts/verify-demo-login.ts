// Proves a DEMO org's seeded staff accounts cannot authenticate through the
// real staff login path (and therefore can never obtain a cln_session). This
// is an actual login attempt via authenticate() — the exact credential gate
// login() uses — not an assertion about the UI.
//
// Usage: DATABASE_URL=... tsx scripts/verify-demo-login.ts  (after migrate)

import bcrypt from "bcryptjs"
import { systemDb } from "../src/lib/org-db"
import { createDemoOrg } from "../src/lib/demo/provision"
import { authenticate } from "../src/lib/auth-core"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  // A real (non-demo) org + user as the positive control.
  const realOrg = await systemDb.organization.create({ data: { name: "Real Co", slug: `real-${Date.now()}`, packageTier: "TEAM", timezone: "UTC" } })
  await systemDb.user.create({ data: { organizationId: realOrg.id, name: "Real Owner", email: `real-owner-${Date.now()}@t.co`, password: await bcrypt.hash("realpass123", 10), role: "OWNER", isActive: true } })
  const realOwner = await systemDb.user.findFirstOrThrow({ where: { organizationId: realOrg.id }, select: { email: true } })

  // A demo org with its 11 seeded staff (all password "demo1234").
  const demo = await createDemoOrg("5.5.5.5", 2)
  const demoAll = await systemDb.user.findMany({ where: { organizationId: demo.orgId }, select: { email: true, role: true } })
  const demoStaff = demoAll.filter((u) => u.role !== "CLIENT")
  check("demo seeded 11 staff accounts", demoStaff.length === 11, `staff=${demoStaff.length} total=${demoAll.length}`)

  console.log("A real staff account authenticates normally (positive control):")
  const realOk = await authenticate(realOwner.email, "realpass123")
  check("real owner logs in with correct password", realOk.ok === true)
  check("real owner rejected with wrong password", (await authenticate(realOwner.email, "nope")).ok === false)

  console.log("EVERY demo staff account is REFUSED at the real login, even with the correct seeded password:")
  for (const u of demoStaff) {
    const res = await authenticate(u.email, "demo1234") // the real seeded password
    check(`demo ${u.role} <${u.email.split("@")[0]}> cannot log in (no session issued)`, res.ok === false && !("user" in res), res.ok ? "LOGGED IN!" : res.error)
  }

  // The demo owner returned for the sandbox session is one of the blocked accounts.
  const ownerAttempt = await authenticate(demo.owner.email, "demo1234")
  check("the demo OWNER specifically is blocked from staff login", ownerAttempt.ok === false)

  await systemDb.organization.deleteMany({ where: { OR: [{ id: realOrg.id }, { isDemo: true }] } })
  console.log(`\n${failures === 0 ? "DEMO LOGIN CORRECTLY BLOCKED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
