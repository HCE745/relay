import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { AssetDetail } from "./AssetDetail"

export const dynamic = "force-dynamic"

export default async function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, entityId } = await getEntityContext()

  const asset = await prisma.fixedAsset.findUnique({
    where: { id },
    include: { depreciationEntries: { orderBy: { periodNumber: "asc" } } },
  })

  if (!asset || asset.tenantId !== tenantId || asset.entityId !== entityId) notFound()

  // Load accounts for dispose form
  const [cashAccounts, gainLossAccounts] = await Promise.all([
    prisma.account.findMany({
      where: { tenantId, entityId, type: "ASSET", isActive: true, normalBalance: "DEBIT" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.account.findMany({
      where: { tenantId, entityId, type: { in: ["INCOME", "EXPENSE"] }, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ])

  const accumulatedDepreciation = asset.depreciationEntries
    .filter((e) => e.status === "POSTED")
    .reduce((s, e) => s + e.amountCents, 0)

  const serialized = {
    ...asset,
    acquisitionDate: asset.acquisitionDate.toISOString(),
    inServiceDate: asset.inServiceDate.toISOString(),
    disposedAt: asset.disposedAt?.toISOString() ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    depreciationEntries: asset.depreciationEntries.map((e) => ({
      ...e,
      periodDate: e.periodDate.toISOString(),
    })),
    accumulatedDepreciationCents: accumulatedDepreciation,
    netBookValueCents: asset.costCents - accumulatedDepreciation,
  }

  const defaultGainLoss = gainLossAccounts.find((a) => a.code === "7100")

  return (
    <AssetDetail
      asset={serialized}
      cashAccounts={cashAccounts}
      gainLossAccounts={gainLossAccounts}
      defaultGainLossAccountId={defaultGainLoss?.id ?? ""}
    />
  )
}
