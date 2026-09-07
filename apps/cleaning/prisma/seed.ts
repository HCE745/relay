import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const PASSWORD = "password123"

async function seedUser(
  orgId: string,
  email: string,
  name: string,
  role: "OWNER" | "ADMIN" | "MANAGER" | "SUPERVISOR" | "CLEANER",
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, organizationId: orgId, isActive: true },
    create: { email, name, role, organizationId: orgId, password: passwordHash },
  })
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // ── Primary org: Sparkle Co (TEAM tier) ─────────────────────────────────────
  const sparkle = await prisma.organization.upsert({
    where: { slug: "sparkle-co" },
    update: {},
    create: {
      name: "Sparkle Co",
      slug: "sparkle-co",
      packageTier: "TEAM",
      subscriptionStatus: "active",
      onboardingCompletedAt: new Date(),
    },
  })

  await seedUser(sparkle.id, "owner@sparkle.test", "Olivia Owner", "OWNER", passwordHash)
  await seedUser(sparkle.id, "admin@sparkle.test", "Aaron Admin", "ADMIN", passwordHash)
  await seedUser(sparkle.id, "supervisor@sparkle.test", "Sam Supervisor", "SUPERVISOR", passwordHash)
  const cleaner = await seedUser(sparkle.id, "cleaner@sparkle.test", "Casey Cleaner", "CLEANER", passwordHash)

  await prisma.employeeProfile.upsert({
    where: { userId: cleaner.id },
    update: {},
    create: {
      userId: cleaner.id,
      organizationId: sparkle.id,
      employeeCode: "EMP-1001",
      payType: "HOURLY",
      payRate: "22.50",
      employmentStatus: "ACTIVE",
      hireDate: new Date("2025-01-15"),
    },
  })

  await prisma.customer.upsert({
    where: { id: "seed-customer-sparkle" },
    update: {},
    create: {
      id: "seed-customer-sparkle",
      organizationId: sparkle.id,
      name: "Downtown Office Tower",
      email: "facilities@downtown.test",
    },
  })

  // A default QC template so managers/supervisors can inspect out of the box.
  await prisma.inspectionTemplate.upsert({
    where: { id: "seed-inspection-tpl-sparkle" },
    update: {},
    create: {
      id: "seed-inspection-tpl-sparkle",
      organizationId: sparkle.id,
      name: "Standard Site Inspection",
      passThreshold: 80,
      items: {
        create: [
          { label: "Floors clean and dry", points: 2, sortOrder: 0 },
          { label: "Restrooms stocked and sanitized", points: 3, isCritical: true, sortOrder: 1 },
          { label: "Trash emptied", points: 1, sortOrder: 2 },
          { label: "Surfaces dusted", points: 1, sortOrder: 3 },
        ],
      },
    },
  })

  // ── Second org: Rival Cleaners (SOLO tier) — for cross-org isolation checks ──
  const rival = await prisma.organization.upsert({
    where: { slug: "rival-cleaners" },
    update: {},
    create: {
      name: "Rival Cleaners",
      slug: "rival-cleaners",
      packageTier: "SOLO",
      subscriptionStatus: "active",
      onboardingCompletedAt: new Date(),
    },
  })
  await seedUser(rival.id, "owner@rival.test", "Rita Rival", "OWNER", passwordHash)
  await prisma.customer.upsert({
    where: { id: "seed-customer-rival" },
    update: {},
    create: {
      id: "seed-customer-rival",
      organizationId: rival.id,
      name: "Rival's Private Client",
      email: "secret@rival.test",
    },
  })

  console.log("Seed complete.")
  console.log(`  Sparkle Co (${sparkle.packageTier}) — id ${sparkle.id}`)
  console.log("    owner@sparkle.test / admin@sparkle.test / supervisor@sparkle.test / cleaner@sparkle.test")
  console.log(`  Rival Cleaners (${rival.packageTier}) — id ${rival.id}`)
  console.log("    owner@rival.test")
  console.log(`  All passwords: ${PASSWORD}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
