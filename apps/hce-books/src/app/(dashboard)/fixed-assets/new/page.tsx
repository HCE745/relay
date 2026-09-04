import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { ensureFixedAssetAccounts } from "@/lib/fixed-assets"
import { NewAssetForm } from "./NewAssetForm"

export const dynamic = "force-dynamic"

export default async function NewFixedAssetPage() {
  const { tenantId, entityId } = await getEntityContext()

  await ensureFixedAssetAccounts(tenantId, entityId)

  const [assetAccounts, accumDepAccounts, expenseAccounts, sourceAccounts, gainLossAccounts] = await Promise.all([
    // Asset accounts for fixed-asset account (typically code 1500+, ASSET type, not current)
    prisma.account.findMany({
      where: { tenantId, entityId, type: "ASSET", isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    // Accumulated depreciation account (contra-asset — ASSET type, credit normal)
    prisma.account.findMany({
      where: { tenantId, entityId, type: "ASSET", isActive: true, normalBalance: "CREDIT" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    // Depreciation expense accounts
    prisma.account.findMany({
      where: { tenantId, entityId, type: "EXPENSE", isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    // Source accounts (how acquisition was paid — ASSET or LIABILITY)
    prisma.account.findMany({
      where: { tenantId, entityId, type: { in: ["ASSET", "LIABILITY"] }, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    // Gain/Loss on disposal accounts
    prisma.account.findMany({
      where: { tenantId, entityId, type: { in: ["INCOME", "EXPENSE"] }, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ])

  // Determine default account IDs
  const defaultAssetAccount = assetAccounts.find((a) => a.code === "1500")
  const defaultAccumDep = accumDepAccounts.find((a) => a.code === "1510")
  const defaultDepExp = expenseAccounts.find((a) => a.code === "6100")
  const defaultGainLoss = gainLossAccounts.find((a) => a.code === "7100")
  const defaultCash = sourceAccounts.find((a) => a.code === "1000" || a.code === "1010")

  return (
    <NewAssetForm
      entityId={entityId}
      assetAccounts={assetAccounts}
      accumDepAccounts={accumDepAccounts}
      expenseAccounts={expenseAccounts}
      sourceAccounts={sourceAccounts}
      gainLossAccounts={gainLossAccounts}
      defaults={{
        assetAccountId: defaultAssetAccount?.id ?? "",
        accumulatedDepreciationAccountId: defaultAccumDep?.id ?? "",
        depreciationExpenseAccountId: defaultDepExp?.id ?? "",
        gainLossAccountId: defaultGainLoss?.id ?? "",
        sourceAccountId: defaultCash?.id ?? "",
      }}
    />
  )
}
