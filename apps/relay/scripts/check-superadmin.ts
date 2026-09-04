import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 })
const prisma  = new PrismaClient({ adapter })

async function main() {
  const admins = await prisma.superAdmin.findMany()
  console.log("Super admins in DB:", admins.length)
  for (const a of admins) {
    console.log(`  id=${a.id} email=${a.email} name=${a.name} isActive=${a.isActive}`)
    const match = await bcrypt.compare("12345678qW!", a.password)
    console.log(`  password matches "12345678qW!": ${match}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
