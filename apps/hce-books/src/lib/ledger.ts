/**
 * Double-entry ledger service.
 * Rules:
 *   - All amounts in integer cents (no floats in the ledger).
 *   - Entries POSTED only when sum(debits) === sum(credits).
 *   - POSTED entries are immutable; corrections via void + reversing entry.
 *   - Posting into a CLOSED period is blocked.
 *   - Every post/void writes an AuditLog row.
 */
import "server-only"
import { prisma } from "./prisma"
import { writeAuditLog } from "./db"
// Re-export for convenience
export { writeAuditLog }
import type { PrismaClient, JournalEntry, JournalLine, AccountType } from "@/generated/prisma/client"

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

export type LedgerLine = {
  accountId: string
  debit?: number
  credit?: number
  classId?: string | null
  departmentId?: string | null
  memo?: string | null
}

export type CreateEntryParams = {
  tenantId: string
  entityId: string
  date: Date
  memo?: string
  source?: JournalEntry["source"]
  sourceId?: string | null
  isIntercompany?: boolean
  counterpartyEntityId?: string | null
  intercompanyGroupId?: string | null
  createdByUserId?: string | null
  lines: LedgerLine[]
}

function assertBalanced(lines: LedgerLine[]) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced entry: debits ${totalDebit} ≠ credits ${totalCredit}`)
  }
}

async function findOpenPeriod(tenantId: string, entityId: string, date: Date) {
  return prisma.accountingPeriod.findFirst({
    where: {
      tenantId,
      entityId,
      periodStart: { lte: date },
      periodEnd: { gte: date },
      status: "OPEN",
    },
  })
}

/** Create a DRAFT journal entry (not yet posted). */
export async function createEntry(params: CreateEntryParams): Promise<JournalEntry> {
  const { lines, tenantId, entityId, ...rest } = params
  return prisma.journalEntry.create({
    data: {
      tenantId,
      entityId,
      ...rest,
      date: params.date,
      status: "DRAFT",
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          classId: l.classId ?? null,
          departmentId: l.departmentId ?? null,
          memo: l.memo ?? null,
        })),
      },
    },
    include: { lines: true },
  })
}

/** Post a DRAFT entry. Validates balance and open period. */
export async function postEntry(
  entryId: string,
  userId?: string | null,
): Promise<JournalEntry & { lines: JournalLine[] }> {
  const entry = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { lines: true },
  })

  if (entry.status !== "DRAFT") {
    throw new Error(`Cannot post entry in status ${entry.status}`)
  }

  // Validate balance
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced: debits ${totalDebit} ≠ credits ${totalCredit}`)
  }

  // Check period is open
  const period = await findOpenPeriod(entry.tenantId, entry.entityId, entry.date)
  if (!period) {
    throw new Error(`No open accounting period for date ${entry.date.toISOString().slice(0, 10)}`)
  }

  const posted = await prisma.journalEntry.update({
    where: { id: entryId },
    data: { status: "POSTED", periodId: period.id },
    include: { lines: true },
  })

  await writeAuditLog({
    tenantId: entry.tenantId,
    entityId: entry.entityId,
    userId,
    action: "POST",
    tableName: "hce_journal_entries",
    recordId: entryId,
    after: { status: "POSTED" },
  })

  return posted
}

/** Create AND post an entry atomically (most common path).
 *  Pass `tx` to enlist in the caller's transaction; omit to open a standalone one. */
export async function createAndPostEntry(
  params: CreateEntryParams,
  tx?: TxClient,
): Promise<JournalEntry & { lines: JournalLine[] }> {
  assertBalanced(params.lines)

  // All DB writes extracted so they run under whichever transaction client is active.
  async function run(db: TxClient): Promise<JournalEntry & { lines: JournalLine[] }> {
    const period = await db.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        entityId: params.entityId,
        periodStart: { lte: params.date },
        periodEnd: { gte: params.date },
        status: "OPEN",
      },
    })
    if (!period) {
      throw new Error(`No open accounting period for date ${params.date.toISOString().slice(0, 10)}`)
    }
    const entry = await db.journalEntry.create({
      data: {
        tenantId: params.tenantId,
        entityId: params.entityId,
        periodId: period.id,
        date: params.date,
        memo: params.memo ?? null,
        source: params.source ?? "MANUAL",
        sourceId: params.sourceId ?? null,
        status: "POSTED",
        isIntercompany: params.isIntercompany ?? false,
        counterpartyEntityId: params.counterpartyEntityId ?? null,
        intercompanyGroupId: params.intercompanyGroupId ?? null,
        createdByUserId: params.createdByUserId ?? null,
        lines: {
          create: params.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            classId: l.classId ?? null,
            departmentId: l.departmentId ?? null,
            memo: l.memo ?? null,
          })),
        },
      },
      include: { lines: true },
    })
    await db.auditLog.create({
      data: {
        tenantId: params.tenantId,
        entityId: params.entityId,
        userId: params.createdByUserId ?? null,
        action: "POST",
        tableName: "hce_journal_entries",
        recordId: entry.id,
        afterJson: { status: "POSTED", source: params.source },
      },
    })
    return entry
  }

  // If caller supplies a tx, use it directly (they control the boundary).
  // Otherwise open a standalone transaction (existing behaviour for non-IC callers).
  return tx ? run(tx) : prisma.$transaction(run)
}

/** Void a POSTED entry. Creates reversing lines in a new entry. */
export async function voidEntry(
  entryId: string,
  userId?: string | null,
): Promise<JournalEntry & { lines: JournalLine[] }> {
  const entry = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { lines: true },
  })

  if (entry.status !== "POSTED") {
    throw new Error(`Cannot void entry in status ${entry.status}`)
  }

  return prisma.$transaction(async (tx) => {
    // Mark original void
    await tx.journalEntry.update({ where: { id: entryId }, data: { status: "VOID" } })

    // Reversing entry
    const reversing = await tx.journalEntry.create({
      data: {
        tenantId: entry.tenantId,
        entityId: entry.entityId,
        periodId: entry.periodId,
        date: entry.date,
        memo: `VOID of entry ${entryId}`,
        source: entry.source,
        sourceId: entry.sourceId,
        status: "POSTED",
        isIntercompany: entry.isIntercompany,
        counterpartyEntityId: entry.counterpartyEntityId,
        intercompanyGroupId: entry.intercompanyGroupId,
        createdByUserId: userId,
        lines: {
          create: entry.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.credit,  // swap
            credit: l.debit,  // swap
            classId: l.classId,
            departmentId: l.departmentId,
          })),
        },
      },
      include: { lines: true },
    })

    await tx.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        entityId: entry.entityId,
        userId,
        action: "VOID",
        tableName: "hce_journal_entries",
        recordId: entryId,
        beforeJson: { status: "POSTED" },
        afterJson: { status: "VOID", reversingEntryId: reversing.id },
      },
    })

    return reversing
  })
}

/** Get the balance of an account (net of POSTED entries). Returns cents. */
export async function getAccountBalance(
  tenantId: string,
  entityId: string,
  accountId: string,
  opts?: { periodStart?: Date; periodEnd?: Date },
): Promise<number> {
  const where = {
    journalEntry: {
      tenantId,
      entityId,
      status: "POSTED" as const,
      date: {
        ...(opts?.periodStart ? { gte: opts.periodStart } : {}),
        ...(opts?.periodEnd ? { lte: opts.periodEnd } : {}),
      },
    },
    accountId,
  }

  const agg = await prisma.journalLine.aggregate({
    where,
    _sum: { debit: true, credit: true },
  })

  const debit = agg._sum.debit ?? 0
  const credit = agg._sum.credit ?? 0

  // Return net debit (positive = debit balance)
  return debit - credit
}

export type TrialBalanceLine = {
  accountId: string
  code: string
  name: string
  type: AccountType
  debit: number
  credit: number
  balance: number
}

/** Get trial balance for an entity for a given period. */
export async function getTrialBalance(
  tenantId: string,
  entityId: string,
  opts?: { periodStart?: Date; periodEnd?: Date },
): Promise<TrialBalanceLine[]> {
  const dateFilter = {
    ...(opts?.periodStart ? { gte: opts.periodStart } : {}),
    ...(opts?.periodEnd ? { lte: opts.periodEnd } : {}),
  }

  const lines = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        tenantId,
        entityId,
        status: "POSTED",
        date: Object.keys(dateFilter).length ? dateFilter : undefined,
      },
    },
    _sum: { debit: true, credit: true },
  })

  const accountIds = lines.map((l) => l.accountId)
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, tenantId, entityId },
    orderBy: { code: "asc" },
  })

  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  return lines
    .map((l) => {
      const acc = accountMap.get(l.accountId)
      if (!acc) return null
      const debit = l._sum.debit ?? 0
      const credit = l._sum.credit ?? 0
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit,
        credit,
        balance: debit - credit,
      } satisfies TrialBalanceLine
    })
    .filter(Boolean) as TrialBalanceLine[]
}

/** Close an accounting period. Blocks future postings. */
export async function closePeriod(
  tenantId: string,
  entityId: string,
  periodId: string,
  userId?: string | null,
): Promise<void> {
  const period = await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } })
  if (period.tenantId !== tenantId || period.entityId !== entityId) {
    throw new Error("Period does not belong to this tenant/entity")
  }
  if (period.status === "CLOSED") throw new Error("Period already closed")

  // Verify trial balance is zero-sum before closing
  const tb = await getTrialBalance(tenantId, entityId, {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  })
  const netBalance = tb.reduce((s, l) => s + l.balance, 0)
  if (netBalance !== 0) {
    throw new Error(`Trial balance is not zero before close: net ${netBalance} cents`)
  }

  await prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: "CLOSED" } })
  await writeAuditLog({
    tenantId,
    entityId,
    userId,
    action: "CLOSE_PERIOD",
    tableName: "hce_accounting_periods",
    recordId: periodId,
    after: { status: "CLOSED" },
  })
}
