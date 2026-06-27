/**
 * Seed: Creates the HCE tenant, HCE + Relay Software entities,
 * an admin user, standard chart of accounts per entity,
 * and an open accounting period for the current year.
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 })
const prisma = new PrismaClient({ adapter })

const CURRENT_YEAR = new Date().getFullYear()

type AccountSeed = {
  code: string; name: string
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"
  subtype?: string
  normalBalance: "DEBIT" | "CREDIT"
}

function getStandardCOA(icCounterpartyName?: string): AccountSeed[] {
  const base: AccountSeed[] = [
    // Assets
    { code: "1000", name: "Cash", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1010", name: "Checking Account", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1100", name: "Accounts Receivable", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1200", name: "Prepaid Expenses", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1300", name: "Inventory", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1500", name: "Property & Equipment", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1510", name: "Accumulated Depreciation", type: "ASSET", normalBalance: "CREDIT" },
    // Liabilities
    { code: "2000", name: "Accounts Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2100", name: "Sales Tax Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2200", name: "Accrued Liabilities", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2300", name: "Deferred Revenue", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2500", name: "Notes Payable", type: "LIABILITY", normalBalance: "CREDIT" },
    // Equity
    { code: "3000", name: "Owner's Equity", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "3100", name: "Retained Earnings", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "3200", name: "Common Stock", type: "EQUITY", normalBalance: "CREDIT" },
    // Income
    { code: "4000", name: "Sales Revenue", type: "INCOME", normalBalance: "CREDIT" },
    { code: "4100", name: "Service Revenue", type: "INCOME", normalBalance: "CREDIT" },
    { code: "4200", name: "Other Income", type: "INCOME", normalBalance: "CREDIT" },
    { code: "4300", name: "Management Fee Income", type: "INCOME", normalBalance: "CREDIT" },
    // COGS
    { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", subtype: "COGS", normalBalance: "DEBIT" },
    { code: "5100", name: "Cost of Services", type: "EXPENSE", subtype: "COGS", normalBalance: "DEBIT" },
    // Expenses
    { code: "6000", name: "Salaries & Wages", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6100", name: "Rent Expense", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6200", name: "Utilities Expense", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6300", name: "Office Supplies", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6400", name: "Marketing & Advertising", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6500", name: "Professional Services", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6600", name: "Insurance", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6700", name: "Depreciation Expense", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6800", name: "Bank Charges", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "6900", name: "Other Operating Expenses", type: "EXPENSE", normalBalance: "DEBIT" },
  ]

  if (icCounterpartyName) {
    base.push(
      {
        code: "1800",
        name: `Intercompany Receivable – ${icCounterpartyName}`,
        type: "ASSET",
        subtype: "INTERCOMPANY_RECEIVABLE",
        normalBalance: "DEBIT",
      },
      {
        code: "2800",
        name: `Intercompany Payable – ${icCounterpartyName}`,
        type: "LIABILITY",
        subtype: "INTERCOMPANY_PAYABLE",
        normalBalance: "CREDIT",
      },
    )
  }

  return base
}

async function createCoaForEntity(
  tenantId: string,
  entityId: string,
  icCounterpartyName?: string,
) {
  const accounts = getStandardCOA(icCounterpartyName)
  for (const acct of accounts) {
    await prisma.account.upsert({
      where: { tenantId_entityId_code: { tenantId, entityId, code: acct.code } },
      create: { tenantId, entityId, ...acct, isActive: true },
      update: {},
    })
  }
}

async function createPeriod(tenantId: string, entityId: string, year: number) {
  await prisma.accountingPeriod.upsert({
    where: {
      tenantId_entityId_periodStart_periodEnd: {
        tenantId,
        entityId,
        periodStart: new Date(`${year}-01-01`),
        periodEnd: new Date(`${year}-12-31`),
      },
    },
    create: {
      tenantId,
      entityId,
      periodStart: new Date(`${year}-01-01`),
      periodEnd: new Date(`${year}-12-31`),
      status: "OPEN",
    },
    update: {},
  })
}

async function main() {
  console.log("Seeding HCE Books…")

  // ── Tenant ──
  const tenant = await prisma.tenant.upsert({
    where: { id: "hce-tenant" },
    create: { id: "hce-tenant", name: "HCE Holdings" },
    update: {},
  })
  console.log("✓ Tenant:", tenant.name)

  // ── Entities ──
  const hce = await prisma.entity.upsert({
    where: { id: "hce-entity" },
    create: {
      id: "hce-entity",
      tenantId: tenant.id,
      name: "HCE",
      legalName: "HCE Holdings, LLC",
      isConsolidationParent: true,
      baseCurrency: "USD",
    },
    update: {},
  })

  const relay = await prisma.entity.upsert({
    where: { id: "relay-entity" },
    create: {
      id: "relay-entity",
      tenantId: tenant.id,
      name: "Relay Software",
      legalName: "Relay Software LLC",
      parentEntityId: hce.id,
      isConsolidationParent: false,
      baseCurrency: "USD",
    },
    update: {},
  })
  console.log("✓ Entities: HCE (parent), Relay Software (child)")

  // ── Admin user ──
  const passwordHash = await bcrypt.hash("HCEbooks2026!", 12)
  const user = await prisma.hceUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "will@hce.com" } },
    create: {
      tenantId: tenant.id,
      email: "will@hce.com",
      name: "Will Hunt",
      passwordHash,
      role: "OWNER",
    },
    update: {},
  })

  // Grant access to both entities
  for (const entityId of [hce.id, relay.id]) {
    await prisma.entityAccess.upsert({
      where: { userId_entityId: { userId: user.id, entityId } },
      create: { userId: user.id, entityId },
      update: {},
    })
  }
  console.log("✓ User: will@hce.com (OWNER)")

  // ── Chart of Accounts ──
  await createCoaForEntity(tenant.id, hce.id, "Relay Software")
  await createCoaForEntity(tenant.id, relay.id, "HCE")
  console.log("✓ Chart of accounts seeded for HCE and Relay")

  // ── Accounting Periods ──
  await createPeriod(tenant.id, hce.id, CURRENT_YEAR)
  await createPeriod(tenant.id, relay.id, CURRENT_YEAR)
  // Also create prior year period
  await createPeriod(tenant.id, hce.id, CURRENT_YEAR - 1)
  await createPeriod(tenant.id, relay.id, CURRENT_YEAR - 1)
  console.log("✓ Accounting periods created")

  // ── Default Classes & Departments for Relay ──
  for (const name of ["Engineering", "Sales", "Operations", "Management"]) {
    await prisma.department.upsert({
      where: { tenantId_entityId_name: { tenantId: tenant.id, entityId: relay.id, name } },
      create: { tenantId: tenant.id, entityId: relay.id, name },
      update: {},
    })
  }
  for (const name of ["SaaS", "Professional Services", "General"]) {
    await prisma.class.upsert({
      where: { tenantId_entityId_name: { tenantId: tenant.id, entityId: relay.id, name } },
      create: { tenantId: tenant.id, entityId: relay.id, name },
      update: {},
    })
  }
  console.log("✓ Classes and departments seeded for Relay")

  console.log("\n✅ Seed complete.")
  console.log("   Tenant ID:", tenant.id)
  console.log("   HCE Entity ID:", hce.id)
  console.log("   Relay Entity ID:", relay.id)
  console.log("   Login: will@hce.com / HCEbooks2026!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
