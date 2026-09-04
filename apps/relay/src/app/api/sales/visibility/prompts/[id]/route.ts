import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { promptText?: string; category?: string; isActive?: boolean }

  const prompt = await prisma.visibilityPrompt.update({
    where: { id },
    data: {
      ...(body.promptText !== undefined ? { promptText: body.promptText.trim() } : {}),
      ...(body.category   !== undefined ? { category: body.category as never }   : {}),
      ...(body.isActive   !== undefined ? { isActive:  body.isActive }            : {}),
    },
  })

  return NextResponse.json({ prompt })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.visibilityPrompt.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
