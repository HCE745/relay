// Runtime verification against a live database. Proves the DB exit criteria:
// seed present, every role authenticates, landing routes are correct, capability
// resolution matches the tier, and cross-organization access is prevented.
//
// Usage: DATABASE_URL=... tsx scripts/verify-db.ts   (run after migrate + seed)

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { experienceForRole, landingPathForRole } from "../src/lib/rbac"
import { scopeWhere } from "../src/lib/org-scope"
import { resolveCapabilities, parseOverrides } from "../src/lib/entitlements/can-use"
import type { PackageTier } from "../src/lib/entitlements/packages"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  console.log("Auth — every seeded role authenticates and lands correctly:")
  const expected: Array<[string, string, string]> = [
    ["owner@sparkle.test", "OWNER", "/dashboard"],
    ["admin@sparkle.test", "ADMIN", "/dashboard"],
    ["supervisor@sparkle.test", "SUPERVISOR", "/dashboard"],
    ["cleaner@sparkle.test", "CLEANER", "/today"],
    ["owner@rival.test", "OWNER", "/dashboard"],
  ]
  for (const [email, role, landing] of expected) {
    const user = await prisma.user.findUnique({ where: { email } })
    const authed = !!user && (await bcrypt.compare("password123", user.password))
    check(`${email} authenticates as ${role}`, authed && user!.role === role)
    if (user) {
      check(
        `${email} lands at ${landing} (${experienceForRole(user.role)} experience)`,
        landingPathForRole(user.role) === landing,
      )
    }
  }

  console.log("\nCapabilities — resolved from tier at runtime:")
  const sparkle = await prisma.organization.findUniqueOrThrow({ where: { slug: "sparkle-co" } })
  const rival = await prisma.organization.findUniqueOrThrow({ where: { slug: "rival-cleaners" } })
  const sparkleCaps = resolveCapabilities({
    packageTier: sparkle.packageTier as PackageTier,
    capabilityOverrides: parseOverrides(sparkle.capabilityOverrides),
  })
  const rivalCaps = resolveCapabilities({
    packageTier: rival.packageTier as PackageTier,
    capabilityOverrides: parseOverrides(rival.capabilityOverrides),
  })
  check("Sparkle (TEAM) has workforce.timeTracking", sparkleCaps.has("workforce.timeTracking"))
  check("Sparkle (TEAM) lacks procurement.purchaseOrders", !sparkleCaps.has("procurement.purchaseOrders"))
  check("Rival (SOLO) lacks workforce.timeTracking", !rivalCaps.has("workforce.timeTracking"))

  console.log("\nTenant isolation — org-scoped queries never leak across orgs:")
  const sparkleCustomers = await prisma.customer.findMany({ where: scopeWhere(sparkle.id) })
  check(
    "Sparkle scope returns only Sparkle customers",
    sparkleCustomers.length > 0 && sparkleCustomers.every((c) => c.organizationId === sparkle.id),
    `${sparkleCustomers.length} rows`,
  )
  check(
    "Sparkle scope excludes Rival's private customer",
    !sparkleCustomers.some((c) => c.name.includes("Rival")),
  )
  const rivalCustomers = await prisma.customer.findMany({ where: scopeWhere(rival.id) })
  check(
    "Rival scope returns only Rival customers",
    rivalCustomers.length > 0 && rivalCustomers.every((c) => c.organizationId === rival.id),
    `${rivalCustomers.length} rows`,
  )

  console.log("\nEmployee profile — HR/pay data lives off the auth row:")
  const cleaner = await prisma.user.findUniqueOrThrow({
    where: { email: "cleaner@sparkle.test" },
    include: { employeeProfile: true },
  })
  check("Cleaner has an EmployeeProfile with a pay rate", !!cleaner.employeeProfile?.payRate)

  console.log(`\n${failures === 0 ? "ALL DB CHECKS PASSED" : `${failures} DB CHECK(S) FAILED`}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
