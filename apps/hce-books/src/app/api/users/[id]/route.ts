import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertCan } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// PATCH /api/users/[id] — update role, entity access, or active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireSession()
  const deny = assertCan(session, "manageUsers"); if (deny) return deny

  const target = await prisma.hceUser.findFirst({
    where: { id, tenantId: session.tenantId },
  })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Prevent self-demotion or self-deactivation
  if (target.id === session.userId) {
    return NextResponse.json({ error: "Cannot edit your own account" }, { status: 400 })
  }

  const body = await req.json()
  const { role, entityIds, active } = body as {
    role?: string
    entityIds?: string[]
    active?: boolean
  }

  const validRoles = ["OWNER", "ADMIN", "ACCOUNTANT", "BOOKKEEPER", "VIEWER"]
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  // Validate entityIds if provided
  if (entityIds !== undefined) {
    const entities = await prisma.entity.findMany({
      where: { tenantId: session.tenantId, id: { in: entityIds } },
      select: { id: true },
    })
    if (entities.length !== entityIds.length) {
      return NextResponse.json({ error: "One or more entity IDs are invalid" }, { status: 400 })
    }
  }

  // Update user fields
  await prisma.hceUser.update({
    where: { id },
    data: {
      ...(role ? { role: role as never } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  })

  // Replace entity access if provided
  if (entityIds !== undefined) {
    await prisma.entityAccess.deleteMany({ where: { userId: id } })
    if (entityIds.length > 0) {
      await prisma.entityAccess.createMany({
        data: entityIds.map((eid) => ({ userId: id, entityId: eid })),
        skipDuplicates: true,
      })
    }
  }

  const updated = await prisma.hceUser.findUnique({
    where: { id },
    include: { entityAccess: true },
  })

  return NextResponse.json({
    id: updated!.id,
    email: updated!.email,
    name: updated!.name,
    role: updated!.role,
    active: updated!.active,
    entityAccess: updated!.entityAccess.map((a) => a.entityId),
  })
}

// DELETE /api/users/[id] — hard delete (internal only; prefer PATCH active=false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireSession()
  const deny = assertCan(session, "manageUsers"); if (deny) return deny

  const target = await prisma.hceUser.findFirst({ where: { id, tenantId: session.tenantId } })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (target.id === session.userId) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })

  await prisma.hceUser.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
