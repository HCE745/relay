/**
 * Creates the demo sales account and seeds realistic CRM data.
 * Usage: npx dotenv-cli -e .env -- npx tsx scripts/seed-sales-demo.ts
 */
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { clearDemoData, seedDemoData } from "@/lib/sales-demo-seed"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 })
const prisma = new PrismaClient({ adapter })

const DEMO_EMAIL = "demo-sales@getrelay.software"
const DEMO_PASSWORD = "SalesDemo2026!"

async function main() {
  console.log("Creating demo sales account…")

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const demoUser = await prisma.salesUser.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, isActive: true, isDemo: true },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo Sales",
      role: "admin_sales",
      isActive: true,
      isDemo: true,
    },
  })

  console.log(`Demo user: ${demoUser.id} (${demoUser.email})`)
  console.log("Clearing existing demo data…")
  await clearDemoData(demoUser.id)

  console.log("Seeding demo data…")
  await seedDemoData(demoUser.id)

  console.log("\n✅ Demo seed complete!")
  console.log(`   Email:    ${DEMO_EMAIL}`)
  console.log(`   Password: ${DEMO_PASSWORD}`)
  console.log(`   Login at: /sales/login`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
