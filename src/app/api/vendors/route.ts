import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    console.log("[/api/vendors] no session — returning 401")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // BillForm passes entityId as a query param so we don't rely on cookie resolution.
  // Validate it belongs to this tenant before using it.
  const { searchParams } = new URL(req.url)
  const paramEntityId = searchParams.get("entityId")

  let entityId: string | null = null

  if (paramEntityId) {
    // Quick tenant ownership check
    const entity = await prisma.entity.findFirst({
      where: { id: paramEntityId, tenantId: session.tenantId },
      select: { id: true },
    })
    entityId = entity?.id ?? null
    console.log("[/api/vendors] param entityId:", paramEntityId, "→ resolved:", entityId ?? "not found for tenant")
  }

  if (!entityId) {
    console.log("[/api/vendors] no valid entityId — returning empty list")
    return NextResponse.json([])
  }

  const vendors = await prisma.vendor.findMany({
    where: { tenantId: session.tenantId, entityId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
  console.log("[/api/vendors] tenantId:", session.tenantId, "entityId:", entityId, "→", vendors.length, "vendors")
  return NextResponse.json(vendors)
}
