import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cookieStore = await cookies()
  const entityCookieId = cookieStore.get("hce-entity")?.value

  // Same fallback as getEntityContext: prefer cookie value, fall back to first entity
  const entities = await prisma.entity.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
    select: { id: true },
  })
  const entityId = entities.find((e) => e.id === entityCookieId)?.id ?? entities[0]?.id
  if (!entityId) return NextResponse.json([])

  const vendors = await prisma.vendor.findMany({
    where: { tenantId: session.tenantId, entityId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
  return NextResponse.json(vendors)
}
