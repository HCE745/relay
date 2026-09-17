import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { name, daysAfterPrevious, description } = await req.json() as {
    name: string; daysAfterPrevious: number; description?: string
  }

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  try {
    const stage = await prisma.followUpStage.update({
      where: { id },
      data: {
        name: name.trim(),
        daysAfterPrevious: Number(daysAfterPrevious) || 0,
        description: description?.trim() || null,
      },
    })
    return NextResponse.json({ stage })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (code === "P2002") return NextResponse.json({ error: "Conflict" }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    const stage = await prisma.followUpStage.findUnique({ where: { id } })

    if (stage?.stageNumber === 0) {
      return NextResponse.json({ error: "Cannot delete Stage 0 (Initial Outreach)" }, { status: 400 })
    }

    await prisma.followUpStage.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 })
    console.error(e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
