import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getPL } from "@/lib/reports"
import { getAccountBalance } from "@/lib/ledger"
import { DashboardStats } from "@/components/layout/DashboardStats"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const ctx = await getEntityContext()
  const { tenantId, entityId, selectedEntity } = ctx

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  // Get cash account balance
  const cashAccount = await prisma.account.findFirst({
    where: { tenantId, entityId, code: "1010" },
  })
  const cashBalance = cashAccount
    ? await getAccountBalance(tenantId, entityId, cashAccount.id)
    : 0

  // Get AR balance
  const arAccount = await prisma.account.findFirst({
    where: { tenantId, entityId, code: "1100" },
  })
  const arBalance = arAccount
    ? await getAccountBalance(tenantId, entityId, arAccount.id)
    : 0

  // Get AP balance
  const apAccount = await prisma.account.findFirst({
    where: { tenantId, entityId, code: "2000" },
  })
  const apBalance = apAccount
    ? Math.abs(await getAccountBalance(tenantId, entityId, apAccount.id))
    : 0

  // P&L for current month
  let pl: { netIncome: number; totalRevenue: number; totalExpenses: number } = {
    netIncome: 0,
    totalRevenue: 0,
    totalExpenses: 0,
  }
  try {
    const result = await getPL(tenantId, entityId, { start: periodStart, end: periodEnd })
    pl = result
  } catch {}

  // Recent journal entries
  const recentEntries = await prisma.journalEntry.findMany({
    where: { tenantId, entityId, status: "POSTED" },
    include: { lines: { include: { account: true }, take: 2 } },
    orderBy: { date: "desc" },
    take: 10,
  })

  // Overdue invoices count
  const overdueCount = await prisma.invoice.count({
    where: { tenantId, entityId, status: "OVERDUE" },
  })

  // Unpaid bills count
  const unpaidBillsCount = await prisma.bill.count({
    where: { tenantId, entityId, status: { in: ["ENTERED", "PARTIAL"] } },
  })

  return (
    <DashboardStats
      entityName={selectedEntity?.name ?? ""}
      cashBalance={cashBalance}
      arBalance={arBalance}
      apBalance={apBalance}
      netIncome={pl.netIncome}
      totalRevenue={pl.totalRevenue}
      totalExpenses={pl.totalExpenses}
      overdueInvoices={overdueCount}
      unpaidBills={unpaidBillsCount}
      recentEntries={recentEntries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        memo: e.memo ?? "",
        source: e.source,
        firstAccount: e.lines[0]?.account.name ?? "",
        amount: e.lines.filter((l) => l.debit > 0).reduce((s, l) => s + l.debit, 0),
      }))}
    />
  )
}
