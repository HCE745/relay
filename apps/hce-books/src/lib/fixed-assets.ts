import "server-only"
import { prisma } from "./prisma"
import { createAndPostEntry, writeAuditLog } from "./ledger"
import type { LedgerLine } from "./ledger"
import type { AssetCategory, DepreciationMethod } from "@/generated/prisma/client"

// ─── ACCOUNT SEEDING ─────────────────────────────────────────────────────────

export async function ensureFixedAssetAccounts(tenantId: string, entityId: string) {
  const defaults = [
    { code: "1500", name: "Fixed Assets", type: "ASSET" as const, normalBalance: "DEBIT" as const, isCurrent: false },
    { code: "1510", name: "Accumulated Depreciation", type: "ASSET" as const, normalBalance: "CREDIT" as const, isCurrent: false },
    { code: "6100", name: "Depreciation Expense", type: "EXPENSE" as const, normalBalance: "DEBIT" as const, isCurrent: true },
    { code: "7100", name: "Gain/Loss on Disposal of Assets", type: "INCOME" as const, normalBalance: "CREDIT" as const, isCurrent: true },
  ]
  await Promise.all(
    defaults.map((acct) =>
      prisma.account.upsert({
        where: { tenantId_entityId_code: { tenantId, entityId, code: acct.code } },
        update: {},
        create: { tenantId, entityId, ...acct },
      })
    )
  )
}

// ─── DEPRECIATION MATH ───────────────────────────────────────────────────────

function periodEndDate(inServiceDate: Date, periodIndex: number): Date {
  // Returns last day of month (periodIndex months after inServiceDate's month)
  return new Date(Date.UTC(
    inServiceDate.getUTCFullYear(),
    inServiceDate.getUTCMonth() + periodIndex + 1,
    0, // day 0 = last day of previous month
  ))
}

function generateSchedule(
  costCents: number,
  salvageValueCents: number,
  usefulLifeMonths: number,
  inServiceDate: Date,
) {
  const depreciableAmount = costCents - salvageValueCents
  if (depreciableAmount <= 0) return []
  const baseAmount = Math.floor(depreciableAmount / usefulLifeMonths)
  const remainder = depreciableAmount - baseAmount * usefulLifeMonths

  return Array.from({ length: usefulLifeMonths }, (_, i) => ({
    periodNumber: i + 1,
    periodDate: periodEndDate(inServiceDate, i),
    amountCents: i === usefulLifeMonths - 1 ? baseAmount + remainder : baseAmount,
  }))
}

// ─── CREATE ASSET ─────────────────────────────────────────────────────────────

export type CreateAssetParams = {
  tenantId: string
  entityId: string
  name: string
  description?: string
  category: AssetCategory
  acquisitionDate: Date
  inServiceDate: Date
  costCents: number
  salvageValueCents: number
  usefulLifeMonths: number
  depreciationMethod: DepreciationMethod
  assetAccountId: string
  accumulatedDepreciationAccountId: string
  depreciationExpenseAccountId: string
  sourceAccountId: string
  gainLossAccountId?: string
  createdByUserId?: string | null
}

export async function createAsset(params: CreateAssetParams) {
  const { tenantId, entityId } = params

  // Post acquisition: DR Fixed Asset / CR Source
  const acquisitionEntry = await createAndPostEntry({
    tenantId,
    entityId,
    date: params.acquisitionDate,
    memo: `Asset acquisition: ${params.name}`,
    source: "FIXED_ASSET",
    createdByUserId: params.createdByUserId ?? null,
    lines: [
      { accountId: params.assetAccountId, debit: params.costCents },
      { accountId: params.sourceAccountId, credit: params.costCents },
    ],
  })

  const schedule = generateSchedule(
    params.costCents,
    params.salvageValueCents,
    params.usefulLifeMonths,
    params.inServiceDate,
  )

  const asset = await prisma.fixedAsset.create({
    data: {
      tenantId,
      entityId,
      name: params.name,
      description: params.description ?? null,
      category: params.category,
      acquisitionDate: params.acquisitionDate,
      inServiceDate: params.inServiceDate,
      costCents: params.costCents,
      salvageValueCents: params.salvageValueCents,
      usefulLifeMonths: params.usefulLifeMonths,
      depreciationMethod: params.depreciationMethod,
      assetAccountId: params.assetAccountId,
      accumulatedDepreciationAccountId: params.accumulatedDepreciationAccountId,
      depreciationExpenseAccountId: params.depreciationExpenseAccountId,
      sourceAccountId: params.sourceAccountId,
      gainLossAccountId: params.gainLossAccountId ?? null,
      status: "ACTIVE",
      acquisitionEntryId: acquisitionEntry.id,
      depreciationEntries: { create: schedule },
    },
    include: { depreciationEntries: { orderBy: { periodNumber: "asc" } } },
  })

  await writeAuditLog({
    tenantId,
    entityId,
    userId: params.createdByUserId,
    action: "CREATE",
    tableName: "hce_fixed_assets",
    recordId: asset.id,
    after: { name: asset.name, costCents: asset.costCents, acquisitionEntryId: acquisitionEntry.id },
  })

  return asset
}

// ─── POST DEPRECIATION ────────────────────────────────────────────────────────

export async function postDepreciation(
  tenantId: string,
  entityId: string,
  assetId: string,
  throughDate: Date,
  userId?: string | null,
) {
  const asset = await prisma.fixedAsset.findUniqueOrThrow({ where: { id: assetId } })

  if (asset.tenantId !== tenantId || asset.entityId !== entityId) {
    throw new Error("Asset not found")
  }
  if (asset.status === "DISPOSED") {
    throw new Error("Cannot post depreciation on a disposed asset")
  }

  const dueEntries = await prisma.depreciationEntry.findMany({
    where: { fixedAssetId: assetId, status: "SCHEDULED", periodDate: { lte: throughDate } },
    orderBy: { periodNumber: "asc" },
  })

  let postedCount = 0
  for (const entry of dueEntries) {
    // Re-read inside loop for idempotency (another process might have posted it)
    const fresh = await prisma.depreciationEntry.findUnique({ where: { id: entry.id } })
    if (!fresh || fresh.status === "POSTED") continue

    const je = await createAndPostEntry({
      tenantId,
      entityId,
      date: entry.periodDate,
      memo: `Depreciation: ${asset.name} (period ${entry.periodNumber}/${asset.usefulLifeMonths})`,
      source: "DEPRECIATION",
      sourceId: assetId,
      createdByUserId: userId ?? null,
      lines: [
        { accountId: asset.depreciationExpenseAccountId, debit: entry.amountCents },
        { accountId: asset.accumulatedDepreciationAccountId, credit: entry.amountCents },
      ],
    })

    await prisma.depreciationEntry.update({
      where: { id: entry.id },
      data: { status: "POSTED", journalEntryId: je.id },
    })
    postedCount++
  }

  // Check if all entries are now posted → fully depreciated
  const remainingScheduled = await prisma.depreciationEntry.count({
    where: { fixedAssetId: assetId, status: "SCHEDULED" },
  })
  if (remainingScheduled === 0 && asset.status === "ACTIVE") {
    await prisma.fixedAsset.update({ where: { id: assetId }, data: { status: "FULLY_DEPRECIATED" } })
  }

  await writeAuditLog({
    tenantId,
    entityId,
    userId,
    action: "POST_DEPRECIATION",
    tableName: "hce_fixed_assets",
    recordId: assetId,
    after: { periodsPosted: postedCount, throughDate: throughDate.toISOString() },
  })

  return { posted: postedCount }
}

// ─── DISPOSE ASSET ────────────────────────────────────────────────────────────

export async function disposeAsset(
  tenantId: string,
  entityId: string,
  assetId: string,
  params: {
    disposalDate: Date
    proceedsCents: number
    cashAccountId?: string | null
    gainLossAccountId: string
    memo?: string
  },
  userId?: string | null,
) {
  const asset = await prisma.fixedAsset.findUniqueOrThrow({ where: { id: assetId } })

  if (asset.tenantId !== tenantId || asset.entityId !== entityId) throw new Error("Asset not found")
  if (asset.status === "DISPOSED") throw new Error("Asset is already disposed")

  // Accumulated depreciation = sum of all POSTED entries for this asset
  const accumResult = await prisma.depreciationEntry.aggregate({
    where: { fixedAssetId: assetId, status: "POSTED" },
    _sum: { amountCents: true },
  })
  const accumulatedDepreciation = accumResult._sum.amountCents ?? 0
  const netBookValue = asset.costCents - accumulatedDepreciation
  const gainLoss = params.proceedsCents - netBookValue // positive = gain, negative = loss

  // Build balanced journal entry
  const lines: LedgerLine[] = []

  // Remove accumulated depreciation contra-asset (DR to clear credit balance)
  if (accumulatedDepreciation > 0) {
    lines.push({ accountId: asset.accumulatedDepreciationAccountId, debit: accumulatedDepreciation })
  }

  // Remove fixed asset (CR to clear debit balance)
  lines.push({ accountId: asset.assetAccountId, credit: asset.costCents })

  // Record cash proceeds (if any)
  if (params.proceedsCents > 0 && params.cashAccountId) {
    lines.push({ accountId: params.cashAccountId, debit: params.proceedsCents })
  }

  // Gain (CR) or Loss (DR) on disposal
  if (gainLoss > 0) {
    lines.push({ accountId: params.gainLossAccountId, credit: gainLoss })
  } else if (gainLoss < 0) {
    lines.push({ accountId: params.gainLossAccountId, debit: -gainLoss })
  }

  const je = await createAndPostEntry({
    tenantId,
    entityId,
    date: params.disposalDate,
    memo: params.memo ?? `Disposal of asset: ${asset.name}`,
    source: "FIXED_ASSET",
    sourceId: assetId,
    createdByUserId: userId ?? null,
    lines,
  })

  // Delete remaining scheduled (not yet posted) depreciation entries
  await prisma.depreciationEntry.deleteMany({
    where: { fixedAssetId: assetId, status: "SCHEDULED" },
  })

  await prisma.fixedAsset.update({
    where: { id: assetId },
    data: {
      status: "DISPOSED",
      disposedAt: params.disposalDate,
      disposalProceedsCents: params.proceedsCents,
    },
  })

  await writeAuditLog({
    tenantId,
    entityId,
    userId,
    action: "DISPOSE",
    tableName: "hce_fixed_assets",
    recordId: assetId,
    after: {
      proceedsCents: params.proceedsCents,
      netBookValue,
      accumulatedDepreciation,
      gainLoss,
      journalEntryId: je.id,
    },
  })

  return { journalEntryId: je.id, gainLoss, netBookValue, accumulatedDepreciation }
}
