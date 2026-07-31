import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { name, daysAfterPrevious, description } = await req.json() as {
    name: string; daysAfterPrevious: number; description?: string
  }

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const stage = await prisma.followUpStage.update({
    where: { id },
    data: {
      name: name.trim(),
      daysAfterPrevious: Number(daysAfterPrevious) || 0,
      description: description?.trim() || null,
    },
  })

  return NextResponse.json({ stage })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const stage = await prisma.followUpStage.findUnique({ where: { id } })

  if (stage?.stageNumber === 0) {
    return NextResponse.json({ error: "Cannot delete Stage 0 (Initial Outreach)" }, { status: 400 })
  }

  await prisma.followUpStage.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
