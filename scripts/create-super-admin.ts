/**
 * Bootstrap the first super admin account.
 * Usage: npx dotenv-cli -e .env -- npx tsx scripts/create-super-admin.ts
 */
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import * as readline from "readline/promises"
import { stdin as input, stdout as output } from "process"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 1,
})
const prisma = new PrismaClient({ adapter })

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question)
  return answer.trim()
}

async function main() {
  const rl = readline.createInterface({ input, output })

  console.log("\n── Create Super Admin ────────────────────────────────────")

  const name     = await prompt(rl, "Full name:  ")
  const email    = await prompt(rl, "Email:      ")
  const password = await prompt(rl, "Password (min 8 chars): ")
  rl.close()

  if (!name || !email || !password || password.length < 8) {
    console.error("All fields required; password must be at least 8 characters.")
    process.exit(1)
  }

  const existing = await prisma.superAdmin.findUnique({ where: { email } })
  if (existing) {
    console.error(`A super admin with email ${email} already exists.`)
    process.exit(1)
  }

  const hashed = await bcrypt.hash(password, 12)
  const admin  = await prisma.superAdmin.create({ data: { name, email, password: hashed } })

  console.log(`\nSuper admin created: ${admin.name} <${admin.email}> (id: ${admin.id})`)
  console.log("Login at /super-admin/login\n")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
