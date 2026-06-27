/**
 * Intercompany transaction helper.
 * Creates a MATCHED PAIR of journal entries sharing one intercompanyGroupId.
 * Both sides are posted atomically — if either fails, both roll back.
 * Validates that IC-receivable on lender equals IC-payable on borrower.
 */
import "server-only"
import { v4 as uuidv4 } from "uuid"
import { prisma } from "./prisma"
import { createAndPostEntry } from "./ledger"

export type ICAccounts = {
  /** Account on fromEntity side (e.g. Intercompany Receivable–Relay) */
  fromReceivableAccountId: string
  /** Cash/bank account on fromEntity that decreases */
  fromCashAccountId: string
  /** Account on toEntity side (e.g. Intercompany Payable–HCE) */
  toPayableAccountId: string
  /** Cash/bank account on toEntity that increases */
  toCashAccountId: string
}

export type CreateIntercompanyParams = {
  tenantId: string
  fromEntityId: string
  toEntityId: string
  amountCents: number
  date: Date
  memo?: string
  accounts: ICAccounts
  createdByUserId?: string | null
}

export async function createIntercompanyTransaction(params: CreateIntercompanyParams) {
  const groupId = uuidv4()

  const [fromEntry, toEntry] = await prisma.$transaction(async (tx) => {
    // FROM side: DR Intercompany Receivable / CR Cash
    const from = await createAndPostEntry({
      tenantId: params.tenantId,
      entityId: params.fromEntityId,
      date: params.date,
      memo: params.memo ?? `Intercompany transfer to ${params.toEntityId}`,
      source: "INTERCOMPANY",
      isIntercompany: true,
      counterpartyEntityId: params.toEntityId,
      intercompanyGroupId: groupId,
      createdByUserId: params.createdByUserId,
      lines: [
        { accountId: params.accounts.fromReceivableAccountId, debit: params.amountCents },
        { accountId: params.accounts.fromCashAccountId, credit: params.amountCents },
      ],
    }, tx)

    // TO side: DR Cash / CR Intercompany Payable
    const to = await createAndPostEntry({
      tenantId: params.tenantId,
      entityId: params.toEntityId,
      date: params.date,
      memo: params.memo ?? `Intercompany transfer from ${params.fromEntityId}`,
      source: "INTERCOMPANY",
      isIntercompany: true,
      counterpartyEntityId: params.fromEntityId,
      intercompanyGroupId: groupId,
      createdByUserId: params.createdByUserId,
      lines: [
        { accountId: params.accounts.toCashAccountId, debit: params.amountCents },
        { accountId: params.accounts.toPayableAccountId, credit: params.amountCents },
      ],
    }, tx)

    return [from, to] as const
  })

  // Validate matched pair: from-receivable debit == to-payable credit
  const fromReceivableLine = fromEntry.lines.find(
    (l) => l.accountId === params.accounts.fromReceivableAccountId,
  )
  const toPayableLine = toEntry.lines.find(
    (l) => l.accountId === params.accounts.toPayableAccountId,
  )

  if (fromReceivableLine?.debit !== toPayableLine?.credit) {
    throw new Error("Intercompany validation failed: receivable ≠ payable")
  }

  return { fromEntry, toEntry, intercompanyGroupId: groupId }
}

/** Get all intercompany groups for an entity. */
export async function getIntercompanyGroups(tenantId: string, entityId: string) {
  const entries = await prisma.journalEntry.findMany({
    where: { tenantId, entityId, isIntercompany: true, status: "POSTED" },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "desc" },
  })

  // Group by intercompanyGroupId
  const groups = new Map<string, typeof entries>()
  for (const e of entries) {
    if (!e.intercompanyGroupId) continue
    if (!groups.has(e.intercompanyGroupId)) groups.set(e.intercompanyGroupId, [])
    groups.get(e.intercompanyGroupId)!.push(e)
  }

  return Array.from(groups.entries()).map(([groupId, entries]) => ({ groupId, entries }))
}
