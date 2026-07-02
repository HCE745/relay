import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const tenantId = session.tenantId

  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? (await getSelectedEntityId())
  const statusParam = searchParams.get("status") ?? "OPEN"
  const status = statusParam === "DISMISSED" ? "DISMISSED" : "OPEN"

  const flags = await prisma.anomalyFlag.findMany({
    where: { tenantId, entityId, status },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json(flags)
}
