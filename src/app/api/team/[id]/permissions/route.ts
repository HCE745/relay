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
  const { canInvite, canChangeEmail } = body

  const isAdminLevel = ["ADMIN", "HR"].includes(session.role)

  // Load all org users to check hierarchy
  const orgUsers = await prisma.user.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, managerId: true, role: true },
  })

  const targetUser = orgUsers.find(u => u.id === targetId)
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const subordinateIds = isAdminLevel
    ? orgUsers.map(u => u.id)
    : getSubordinateIds(session.userId, orgUsers)

  if (!subordinateIds.includes(targetId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Only ADMIN can grant canInvite
  const updateData: { canInvite?: boolean; canChangeEmail?: boolean } = {}

  if (typeof canInvite === "boolean") {
    if (!["ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Only admins can toggle invite permissions" }, { status: 403 })
    }
    // canInvite only makes sense for MANAGER or SUPERVISOR roles
    if (!["MANAGER", "SUPERVISOR"].includes(targetUser.role)) {
      return NextResponse.json({ error: "Invite permission can only be granted to Managers and Supervisors" }, { status: 400 })
    }
    updateData.canInvite = canInvite
  }

  if (typeof canChangeEmail === "boolean") {
    updateData.canChangeEmail = canChangeEmail
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: updateData,
    select: { id: true, canInvite: true, canChangeEmail: true },
  })

  return NextResponse.json(updated)
}
