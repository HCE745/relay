import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { name?: string; website?: string }

  const competitor = await prisma.visibilityCompetitor.update({
    where: { id },
    data: {
      ...(body.name    !== undefined ? { name:    body.name.trim() }             : {}),
      ...(body.website !== undefined ? { website: body.website?.trim() || null } : {}),
    },
  })

  return NextResponse.json({ competitor })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.visibilityCompetitor.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
