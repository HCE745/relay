import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  if (id === session.superAdminId) {
    return NextResponse.json({ error: "Cannot disable yourself" }, { status: 400 })
  }

  const { isActive } = await req.json() as { isActive: boolean }

  await prisma.superAdmin.update({ where: { id }, data: { isActive } })
  return NextResponse.json({ success: true })
}
