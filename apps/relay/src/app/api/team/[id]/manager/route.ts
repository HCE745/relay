import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getSubordinateIds } from "@/lib/hierarchy"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: targetId } = await params
  const body = await request.json()
  const { managerId } = body // null to clear, string to set

  const isAdminLevel = ["ADMIN", "HR"].includes(session.role)

  const orgUsers = await prisma.user.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, managerId: true },
  })

  const targetUser = orgUsers.find(u => u.id === targetId)
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const subordinateIds = isAdminLevel
    ? orgUsers.map(u => u.id)
    : getSubordinateIds(session.userId, orgUsers)

  if (!subordinateIds.includes(targetId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Validate the new manager is in the same org and wouldn't create a cycle
  if (managerId) {
    const newManager = orgUsers.find(u => u.id === managerId)
    if (!newManager) return NextResponse.json({ error: "Manager not found" }, { status: 404 })
    // Prevent cycle: the new manager cannot be a subordinate of the target
    const targetSubordinates = getSubordinateIds(targetId, orgUsers)
    if (targetSubordinates.includes(managerId) || managerId === targetId) {
      return NextResponse.json({ error: "Cannot create a circular reporting relationship" }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { managerId: managerId || null },
    select: { id: true, managerId: true, manager: { select: { name: true } } },
  })

  return NextResponse.json(updated)
}
