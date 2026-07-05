import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ensureFixedAssetAccounts, createAsset } from "@/lib/fixed-assets"
import { cookies } from "next/headers"
import type { AssetCategory, DepreciationMethod } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getEntityId(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("hce-entity")?.value ?? ""
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const entityId = await getEntityId()

  await ensureFixedAssetAccounts(session.tenantId, entityId)

  const assets = await prisma.fixedAsset.findMany({
    where: { tenantId: session.tenantId, entityId },
    include: {
      depreciationEntries: {
        where: { status: "POSTED" },
        select: { amountCents: true },
      },
    },
    orderBy: { acquisitionDate: "desc" },
  })

  const result = assets.map((a) => {
    const accumulatedDepreciation = a.depreciationEntries.reduce((s, e) => s + e.amountCents, 0)
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      acquisitionDate: a.acquisitionDate,
      inServiceDate: a.inServiceDate,
      costCents: a.costCents,
      salvageValueCents: a.salvageValueCents,
      usefulLifeMonths: a.usefulLifeMonths,
      depreciationMethod: a.depreciationMethod,
      status: a.status,
      accumulatedDepreciationCents: accumulatedDepreciation,
      netBookValueCents: a.costCents - accumulatedDepreciation,
      disposedAt: a.disposedAt,
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const entityId = await getEntityId()
  const body = await req.json()

  const {
    name,
    description,
    category,
    acquisitionDate,
    inServiceDate,
    costCents,
    salvageValueCents,
    usefulLifeMonths,
    depreciationMethod,
    assetAccountId,
    accumulatedDepreciationAccountId,
    depreciationExpenseAccountId,
    sourceAccountId,
    gainLossAccountId,
  } = body as {
    name: string
    description?: string
    category: AssetCategory
    acquisitionDate: string
    inServiceDate: string
    costCents: number
    salvageValueCents: number
    usefulLifeMonths: number
    depreciationMethod: DepreciationMethod
    assetAccountId: string
    accumulatedDepreciationAccountId: string
    depreciationExpenseAccountId: string
    sourceAccountId: string
    gainLossAccountId?: string
  }

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (!costCents || costCents <= 0) return NextResponse.json({ error: "costCents must be > 0" }, { status: 400 })
  if (!usefulLifeMonths || usefulLifeMonths <= 0) return NextResponse.json({ error: "usefulLifeMonths must be > 0" }, { status: 400 })
  if (!assetAccountId || !accumulatedDepreciationAccountId || !depreciationExpenseAccountId || !sourceAccountId) {
    return NextResponse.json({ error: "All account IDs are required" }, { status: 400 })
  }

  try {
    const asset = await createAsset({
      tenantId: session.tenantId,
      entityId,
      name,
      description,
      category: category ?? "EQUIPMENT",
      acquisitionDate: new Date(acquisitionDate),
      inServiceDate: new Date(inServiceDate ?? acquisitionDate),
      costCents,
      salvageValueCents: salvageValueCents ?? 0,
      usefulLifeMonths,
      depreciationMethod: depreciationMethod ?? "STRAIGHT_LINE",
      assetAccountId,
      accumulatedDepreciationAccountId,
      depreciationExpenseAccountId,
      sourceAccountId,
      gainLossAccountId,
      createdByUserId: session.userId,
    })
    return NextResponse.json(asset, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 })
  }
}
