import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  // ── Auth check ─────────────────────────────────────────────────────────────
  const session = await getSession()
  if (!session) {
    console.log("VENDORS QUERY CONTEXT:", {
      tenantId: null,
      entityId: null,
      count: 0,
      reason: "no session — SESSION_SECRET may be missing or mismatched on this host",
    })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Entity resolution ───────────────────────────────────────────────────────
  // BillForm passes entityId as a query param (it has it from SSR props) so we
  // don't need to re-derive it from cookies (which can resolve differently on Vercel).
  const { searchParams } = new URL(req.url)
  const paramEntityId = searchParams.get("entityId")

  let entityId: string | null = null
  if (paramEntityId) {
    const entity = await prisma.entity.findFirst({
      where: { id: paramEntityId, tenantId: session.tenantId },
      select: { id: true },
    })
    entityId = entity?.id ?? null
  }

  if (!entityId) {
    console.log("VENDORS QUERY CONTEXT:", {
      tenantId: session.tenantId,
      entityId: null,
      count: 0,
      reason: paramEntityId
        ? `entityId param "${paramEntityId}" not found for tenant "${session.tenantId}"`
        : "no entityId param supplied",
    })
    return NextResponse.json([])
  }

  // ── Query ────────────────────────────────────────────────────────────────────
  const vendors = await prisma.vendor.findMany({
    where: { tenantId: session.tenantId, entityId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
  console.log("VENDORS QUERY CONTEXT:", {
    tenantId: session.tenantId,
    entityId,
    count: vendors.length,
    names: vendors.map((v) => v.name),
  })
  return NextResponse.json(vendors)
}
