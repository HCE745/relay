import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const budget = await prisma.budget.findUnique({ where: { id } })

  if (!budget || budget.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const entityDeny = assertEntityAccess(session, budget.entityId); if (entityDeny) return entityDeny

  return NextResponse.json(budget)
}
