import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const schedule = await prisma.amortizationSchedule.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { entries: { orderBy: { periodNumber: "asc" } } },
  })

  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const entityDeny = assertEntityAccess(session, schedule.entityId); if (entityDeny) return entityDeny
  return NextResponse.json(schedule)
}
