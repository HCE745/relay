import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  const { id } = await params

  // Verify the flag belongs to this tenant
  const existing = await prisma.anomalyFlag.findUnique({ where: { id } })
  if (!existing || existing.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await prisma.anomalyFlag.update({
    where: { id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedBy: session.userId,
    },
  })

  return NextResponse.json(updated)
}
