/**
 * Bank reconciliation engine.
 * - Apply bank rules for auto-categorization.
 * - Match BankTransactions to existing JournalLines or create new entries.
 * - Track cleared balance vs statement balance.
 */
import "server-only"
import { prisma } from "./prisma"
import { createAndPostEntry } from "./ledger"

/** Apply auto-categorization rules to unmatched transactions. */
export async function applyBankRules(tenantId: string, entityId: string) {
  const rules = await prisma.bankRule.findMany({
    where: { tenantId, entityId, isActive: true },
  })
  const unmatched = await prisma.bankTransaction.findMany({
    where: { tenantId, entityId, isMatched: false },
  })

  let applied = 0
  for (const txn of unmatched) {
    for (const rule of rules) {
      let matches = false
      if (rule.matchType === "CONTAINS") {
        matches = txn.name.toLowerCase().includes(rule.matchValue.toLowerCase())
      } else if (rule.matchType === "EQUALS") {
        matches = txn.name.toLowerCase() === rule.matchValue.toLowerCase()
      } else if (rule.matchType === "STARTS_WITH") {
        matches = txn.name.toLowerCase().startsWith(rule.matchValue.toLowerCase())
      }
      if (matches) {
        await prisma.bankTransaction.update({
          where: { id: txn.id },
          data: {
            accountId: rule.accountId ?? undefined,
            memo: rule.memo ?? undefined,
          },
        })
        applied++
        break
      }
    }
  }
  return { applied }
}

export type MatchTransactionParams = {
  bankTransactionId: string
  journalEntryId: string
  userId?: string | null
}

/** Match a bank transaction to an existing journal entry. */
export async function matchTransaction(params: MatchTransactionParams) {
  const txn = await prisma.bankTransaction.findUniqueOrThrow({
    where: { id: params.bankTransactionId },
  })
  if (txn.isMatched) throw new Error("Transaction already matched")

  await prisma.bankTransaction.update({
    where: { id: params.bankTransactionId },
    data: { isMatched: true, matchedEntryId: params.journalEntryId, isCleared: true },
  })
}

export type CreateAndMatchParams = {
  bankTransactionId: string
  accountId: string
  memo?: string
  classId?: string | null
  departmentId?: string | null
  userId?: string | null
}

/** Create a categorized journal entry and match it to a bank transaction. */
export async function createAndMatchTransaction(params: CreateAndMatchParams) {
  const txn = await prisma.bankTransaction.findUniqueOrThrow({
    where: { id: params.bankTransactionId },
    include: { bankAccount: true },
  })
  if (txn.isMatched) throw new Error("Transaction already matched")

  const cashAccountId = txn.bankAccount.ledgerAccountId
  if (!cashAccountId) throw new Error("Bank account has no linked ledger account")

  // amount > 0 = money out (credit cash / debit expense)
  // amount < 0 = money in (debit cash / credit income)
  const abs = Math.abs(txn.amount)
  const lines =
    txn.amount > 0
      ? [
          { accountId: params.accountId, debit: abs, classId: params.classId, departmentId: params.departmentId },
          { accountId: cashAccountId, credit: abs },
        ]
      : [
          { accountId: cashAccountId, debit: abs },
          { accountId: params.accountId, credit: abs, classId: params.classId, departmentId: params.departmentId },
        ]

  const entry = await createAndPostEntry({
    tenantId: txn.tenantId,
    entityId: txn.entityId,
    date: txn.date,
    memo: params.memo ?? txn.name,
    source: "RECONCILIATION",
    createdByUserId: params.userId,
    lines,
  })

  await prisma.bankTransaction.update({
    where: { id: params.bankTransactionId },
    data: { isMatched: true, matchedEntryId: entry.id, isCleared: true },
  })

  return entry
}

export type ReconciliationReport = {
  bankAccountId: string
  statementBalance: number
  clearedBalance: number
  difference: number
  clearedCount: number
  unclearedCount: number
}

/** Get reconciliation summary for a bank account. */
export async function getReconciliationReport(
  bankAccountId: string,
  statementBalanceCents: number,
): Promise<ReconciliationReport> {
  const txns = await prisma.bankTransaction.findMany({ where: { bankAccountId } })

  const cleared = txns.filter((t) => t.isCleared)
  const uncleared = txns.filter((t) => !t.isCleared)

  // Cleared balance = sum of cleared transactions (from bank's perspective)
  // Plaid amount > 0 = debit (money out), negative = credit (money in)
  const clearedBalance = cleared.reduce((s, t) => s - t.amount, 0)

  return {
    bankAccountId,
    statementBalance: statementBalanceCents,
    clearedBalance,
    difference: statementBalanceCents - clearedBalance,
    clearedCount: cleared.length,
    unclearedCount: uncleared.length,
  }
}
