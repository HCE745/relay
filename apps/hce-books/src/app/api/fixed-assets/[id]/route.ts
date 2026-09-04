import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getEntityId(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("hce-entity")?.value ?? ""
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await requireSession()
  const entityId = await getEntityId()

  const asset = await prisma.fixedAsset.findUnique({
    where: { id },
    include: {
      depreciationEntries: { orderBy: { periodNumber: "asc" } },
    },
  })

  if (!asset || asset.tenantId !== session.tenantId || asset.entityId !== entityId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const entityDeny = assertEntityAccess(session, asset.entityId); if (entityDeny) return entityDeny

  const accumulatedDepreciation = asset.depreciationEntries
    .filter((e) => e.status === "POSTED")
    .reduce((s, e) => s + e.amountCents, 0)

  return NextResponse.json({
    ...asset,
    accumulatedDepreciationCents: accumulatedDepreciation,
    netBookValueCents: asset.costCents - accumulatedDepreciation,
  })
}
