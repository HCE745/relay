import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { generateSOPImprovement } from "@/lib/sop-matching"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const sop = await prisma.sOP.findFirst({
    where: { id, organizationId: session.organizationId, isActive: true },
    select: { id: true, _count: { select: { issues: true } } },
  })

  if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (sop._count.issues < 10) {
    return NextResponse.json({ error: "Minimum 10 linked issues required" }, { status: 400 })
  }

  // Fire-and-forget generation
  generateSOPImprovement(id).catch(console.error)

  return NextResponse.json({ ok: true }, { status: 202 })
}
