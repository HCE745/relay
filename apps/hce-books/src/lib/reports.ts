/**
 * Financial reports service.
 * All amounts in cents. CSV export helpers included.
 * Consolidated reports eliminate intercompany entries sharing intercompanyGroupId.
 */
import "server-only"
import { prisma } from "./prisma"
import type { AccountType } from "@/generated/prisma/client"

export type ReportPeriod = { start: Date; end: Date }

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getPostedLines(
  tenantId: string,
  entityIds: string[],
  period: ReportPeriod,
  excludeGroupIds?: Set<string>,
) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      entityId: { in: entityIds },
      status: "POSTED",
      date: { gte: period.start, lte: period.end },
      ...(excludeGroupIds?.size
        ? { intercompanyGroupId: { notIn: Array.from(excludeGroupIds) } }
        : {}),
    },
    include: {
      lines: {
        include: { account: true, class: true, department: true },
      },
    },
  })
  return entries.flatMap((e) => e.lines)
}

async function getICGroupIds(tenantId: string, entityIds: string[], period: ReportPeriod) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      entityId: { in: entityIds },
      status: "POSTED",
      isIntercompany: true,
      intercompanyGroupId: { not: null },
      date: { gte: period.start, lte: period.end },
    },
    select: { intercompanyGroupId: true },
  })
  return new Set(entries.map((e) => e.intercompanyGroupId!).filter(Boolean))
}

function groupByAccount(lines: Awaited<ReturnType<typeof getPostedLines>>) {
  const map = new Map<string, { account: (typeof lines)[0]["account"]; debit: number; credit: number }>()
  for (const line of lines) {
    const existing = map.get(line.accountId)
    if (existing) {
      existing.debit += line.debit
      existing.credit += line.credit
    } else {
      map.set(line.accountId, { account: line.account, debit: line.debit, credit: line.credit })
    }
  }
  return map
}

// ─── TRIAL BALANCE ───────────────────────────────────────────────────────────

export type TrialBalanceLine = {
  code: string; name: string; type: AccountType
  debit: number; credit: number; balance: number
}

export async function getTrialBalance(
  tenantId: string, entityId: string, period: ReportPeriod,
): Promise<TrialBalanceLine[]> {
  const lines = await getPostedLines(tenantId, [entityId], period)
  const grouped = groupByAccount(lines)
  return Array.from(grouped.values())
    .map(({ account, debit, credit }) => ({
      code: account.code, name: account.name, type: account.type,
      debit, credit, balance: debit - credit,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

// ─── P&L ─────────────────────────────────────────────────────────────────────

export type PLLine = { code: string; name: string; amount: number }
export type PLReport = {
  revenue: PLLine[]; totalRevenue: number
  cogs: PLLine[]; totalCogs: number
  grossProfit: number
  expenses: PLLine[]; totalExpenses: number
  netIncome: number
}

export async function getPL(
  tenantId: string, entityId: string, period: ReportPeriod,
  opts?: { consolidated?: boolean },
): Promise<PLReport> {
  const entityIds = opts?.consolidated
    ? await getDescendantEntityIds(tenantId, entityId)
    : [entityId]

  const excludeIds = opts?.consolidated ? await getICGroupIds(tenantId, entityIds, period) : undefined
  const lines = await getPostedLines(tenantId, entityIds, period, excludeIds)
  const grouped = groupByAccount(lines)

  const revenue: PLLine[] = [], cogs: PLLine[] = [], expenses: PLLine[] = []

  for (const { account, debit, credit } of grouped.values()) {
    const net = credit - debit // income accounts: credit increases
    if (account.type === "INCOME") revenue.push({ code: account.code, name: account.name, amount: net })
    else if (account.type === "EXPENSE" && account.subtype === "COGS")
      cogs.push({ code: account.code, name: account.name, amount: debit - credit })
    else if (account.type === "EXPENSE")
      expenses.push({ code: account.code, name: account.name, amount: debit - credit })
  }

  const totalRevenue = revenue.reduce((s, l) => s + l.amount, 0)
  const totalCogs = cogs.reduce((s, l) => s + l.amount, 0)
  const grossProfit = totalRevenue - totalCogs
  const totalExpenses = expenses.reduce((s, l) => s + l.amount, 0)
  const netIncome = grossProfit - totalExpenses

  return { revenue, totalRevenue, cogs, totalCogs, grossProfit, expenses, totalExpenses, netIncome }
}

// ─── BALANCE SHEET ───────────────────────────────────────────────────────────

export type BSSection = { code: string; name: string; amount: number }
export type BSReport = {
  assets: BSSection[]; totalAssets: number
  liabilities: BSSection[]; totalLiabilities: number
  equity: BSSection[]; totalEquity: number
  totalLiabilitiesAndEquity: number
}

export async function getBalanceSheet(
  tenantId: string, entityId: string, asOf: Date,
  opts?: { consolidated?: boolean },
): Promise<BSReport> {
  const period: ReportPeriod = { start: new Date("2000-01-01"), end: asOf }
  const entityIds = opts?.consolidated
    ? await getDescendantEntityIds(tenantId, entityId)
    : [entityId]

  const excludeIds = opts?.consolidated ? await getICGroupIds(tenantId, entityIds, period) : undefined
  const lines = await getPostedLines(tenantId, entityIds, period, excludeIds)
  const grouped = groupByAccount(lines)

  const assets: BSSection[] = [], liabilities: BSSection[] = [], equity: BSSection[] = []

  for (const { account, debit, credit } of grouped.values()) {
    const net = debit - credit
    if (account.type === "ASSET") assets.push({ code: account.code, name: account.name, amount: net })
    else if (account.type === "LIABILITY") liabilities.push({ code: account.code, name: account.name, amount: credit - debit })
    else if (account.type === "EQUITY") equity.push({ code: account.code, name: account.name, amount: credit - debit })
  }

  const totalAssets = assets.reduce((s, l) => s + l.amount, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0)
  const totalEquity = equity.reduce((s, l) => s + l.amount, 0)

  return {
    assets, totalAssets,
    liabilities, totalLiabilities,
    equity, totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
  }
}

// ─── CASH FLOW ───────────────────────────────────────────────────────────────

export type CashFlowReport = {
  operatingActivities: { name: string; amount: number }[]
  totalOperating: number
  investingActivities: { name: string; amount: number }[]
  totalInvesting: number
  financingActivities: { name: string; amount: number }[]
  totalFinancing: number
  netCashChange: number
}

export async function getCashFlow(
  tenantId: string, entityId: string, period: ReportPeriod,
): Promise<CashFlowReport> {
  // Simplified indirect method: start with net income, adjust for non-cash
  const pl = await getPL(tenantId, entityId, period)
  const netIncome = pl.netIncome

  // Get changes in working capital accounts
  const bsStart = await getBalanceSheet(tenantId, entityId, new Date(period.start.getTime() - 1))
  const bsEnd = await getBalanceSheet(tenantId, entityId, period.end)

  const findAsset = (bs: typeof bsStart, name: string) =>
    bs.assets.find((a) => a.name.toLowerCase().includes(name)) ?? { amount: 0 }
  const findLiab = (bs: typeof bsStart, name: string) =>
    bs.liabilities.find((a) => a.name.toLowerCase().includes(name)) ?? { amount: 0 }

  const arChange = findAsset(bsStart, "receivable").amount - findAsset(bsEnd, "receivable").amount
  const apChange = findLiab(bsEnd, "payable").amount - findLiab(bsStart, "payable").amount

  const operatingActivities = [
    { name: "Net Income", amount: netIncome },
    { name: "Change in Accounts Receivable", amount: arChange },
    { name: "Change in Accounts Payable", amount: apChange },
  ]
  const totalOperating = operatingActivities.reduce((s, l) => s + l.amount, 0)

  return {
    operatingActivities, totalOperating,
    investingActivities: [], totalInvesting: 0,
    financingActivities: [], totalFinancing: 0,
    netCashChange: totalOperating,
  }
}

// ─── GENERAL LEDGER ──────────────────────────────────────────────────────────

export async function getGeneralLedger(
  tenantId: string, entityId: string, period: ReportPeriod, accountId?: string,
) {
  return prisma.journalLine.findMany({
    where: {
      journalEntry: {
        tenantId, entityId, status: "POSTED",
        date: { gte: period.start, lte: period.end },
      },
      ...(accountId ? { accountId } : {}),
    },
    include: {
      journalEntry: true,
      account: true,
    },
    orderBy: { journalEntry: { date: "asc" } },
  })
}

// ─── A/R AGING ───────────────────────────────────────────────────────────────

export type AgingBucket = { current: number; days30: number; days60: number; days90: number; over90: number; total: number }
export type ARAgingLine = { customerId: string; customerName: string } & AgingBucket

export async function getARAgingReport(tenantId: string, entityId: string, asOf: Date): Promise<ARAgingLine[]> {
  const invoices = await prisma.invoice.findMany({
    where: { tenantId, entityId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
    include: { customer: true },
  })

  return invoices.map((inv) => {
    const daysPast = Math.floor((asOf.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const due = inv.amountDue
    const bucket: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: due }
    if (daysPast <= 0) bucket.current = due
    else if (daysPast <= 30) bucket.days30 = due
    else if (daysPast <= 60) bucket.days60 = due
    else if (daysPast <= 90) bucket.days90 = due
    else bucket.over90 = due
    return { customerId: inv.customerId, customerName: inv.customer.name, ...bucket }
  })
}

// ─── A/P AGING ───────────────────────────────────────────────────────────────

export type APAgingLine = { vendorId: string; vendorName: string } & AgingBucket

export async function getAPAgingReport(tenantId: string, entityId: string, asOf: Date): Promise<APAgingLine[]> {
  const bills = await prisma.bill.findMany({
    where: { tenantId, entityId, status: { in: ["ENTERED", "PARTIAL"] } },
    include: { vendor: true },
  })

  return bills.map((bill) => {
    const daysPast = Math.floor((asOf.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const due = bill.amountDue
    const bucket: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: due }
    if (daysPast <= 0) bucket.current = due
    else if (daysPast <= 30) bucket.days30 = due
    else if (daysPast <= 60) bucket.days60 = due
    else if (daysPast <= 90) bucket.days90 = due
    else bucket.over90 = due
    return { vendorId: bill.vendorId, vendorName: bill.vendor.name, ...bucket }
  })
}

// ─── P&L BY CLASS / DEPARTMENT ───────────────────────────────────────────────

export async function getPLByClass(tenantId: string, entityId: string, period: ReportPeriod) {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        tenantId, entityId, status: "POSTED",
        date: { gte: period.start, lte: period.end },
      },
      account: { type: { in: ["INCOME", "EXPENSE"] } },
    },
    include: { account: true, class: true },
  })

  const byClass = new Map<string, { name: string; revenue: number; expenses: number }>()
  for (const line of lines) {
    const key = line.classId ?? "__unclassified__"
    const name = line.class?.name ?? "Unclassified"
    const entry = byClass.get(key) ?? { name, revenue: 0, expenses: 0 }
    if (line.account.type === "INCOME") entry.revenue += line.credit - line.debit
    else entry.expenses += line.debit - line.credit
    byClass.set(key, entry)
  }

  return Array.from(byClass.entries()).map(([id, data]) => ({
    classId: id, ...data, netIncome: data.revenue - data.expenses,
  }))
}

export async function getPLByDepartment(tenantId: string, entityId: string, period: ReportPeriod) {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        tenantId, entityId, status: "POSTED",
        date: { gte: period.start, lte: period.end },
      },
      account: { type: { in: ["INCOME", "EXPENSE"] } },
    },
    include: { account: true, department: true },
  })

  const byDept = new Map<string, { name: string; revenue: number; expenses: number }>()
  for (const line of lines) {
    const key = line.departmentId ?? "__unassigned__"
    const name = line.department?.name ?? "Unassigned"
    const entry = byDept.get(key) ?? { name, revenue: 0, expenses: 0 }
    if (line.account.type === "INCOME") entry.revenue += line.credit - line.debit
    else entry.expenses += line.debit - line.credit
    byDept.set(key, entry)
  }

  return Array.from(byDept.entries()).map(([id, data]) => ({
    departmentId: id, ...data, netIncome: data.revenue - data.expenses,
  }))
}

// ─── CONSOLIDATED HELPERS ─────────────────────────────────────────────────────

async function getDescendantEntityIds(tenantId: string, parentEntityId: string): Promise<string[]> {
  const all = await prisma.entity.findMany({ where: { tenantId } })
  const result: string[] = [parentEntityId]
  const children = (parentId: string) => all.filter((e) => e.parentEntityId === parentId)
  const walk = (id: string) => {
    for (const child of children(id)) {
      result.push(child.id)
      walk(child.id)
    }
  }
  walk(parentEntityId)
  return result
}

// ─── CSV EXPORT ──────────────────────────────────────────────────────────────

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h]
        const s = v == null ? "" : String(v)
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(","),
    ),
  ]
  return lines.join("\n")
}

export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2)
}
