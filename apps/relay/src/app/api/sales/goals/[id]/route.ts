export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireManager() {
  const s = await getSession()
  return s?.superAdmin || s?.salesUserRole === "admin_sales" ? s : null
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManager()
  if (!session) return NextResponse.json({ error: "Managers only" }, { status: 403 })
  const { id } = await params
  await prisma.salesGoal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManager()
  if (!session) return NextResponse.json({ error: "Managers only" }, { status: 403 })
  const { id } = await params
  const body = await req.json() as { targetValue?: number; notes?: string; endDate?: string }
  const goal = await prisma.salesGoal.update({
    where: { id },
    data:  {
      ...(body.targetValue !== undefined && { targetValue: body.targetValue }),
      ...(body.notes       !== undefined && { notes:       body.notes }),
      ...(body.endDate     !== undefined && { endDate:     new Date(body.endDate) }),
    },
  })
  return NextResponse.json({ goal })
}
