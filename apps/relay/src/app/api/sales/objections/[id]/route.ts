export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json() as { wasResolved?: boolean; responseGiven?: string }

  const updated = await prisma.crmObjection.update({
    where: { id },
    data: {
      ...(typeof body.wasResolved === "boolean" ? { wasResolved: body.wasResolved } : {}),
      ...(body.responseGiven !== undefined ? { responseGiven: body.responseGiven } : {}),
    },
    include: { salesUser: { select: { id: true, name: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  await prisma.crmObjection.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
