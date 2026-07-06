import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertCan } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

// GET /api/users — list all users in this tenant (Owner/Admin only)
export async function GET(req: NextRequest) {
  const session = await requireSession()
  const deny = assertCan(session, "manageUsers"); if (deny) return deny

  const users = await prisma.hceUser.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
    include: { entityAccess: { include: { entity: { select: { id: true, name: true } } } } },
  })

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt,
      entityAccess: u.entityAccess.map((a) => ({ entityId: a.entityId, entityName: a.entity.name })),
    }))
  )
}

// POST /api/users — invite a new user (Owner/Admin only)
export async function POST(req: NextRequest) {
  const session = await requireSession()
  const deny = assertCan(session, "manageUsers"); if (deny) return deny

  const body = await req.json()
  const { email, name, role, entityIds, tempPassword } = body as {
    email: string
    name?: string
    role: string
    entityIds: string[]
    tempPassword?: string
  }

  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 })
  }

  // Validate role is a known value
  const validRoles = ["OWNER", "ADMIN", "ACCOUNTANT", "BOOKKEEPER", "VIEWER"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  // Validate all entityIds belong to this tenant
  if (entityIds?.length) {
    const entities = await prisma.entity.findMany({
      where: { tenantId: session.tenantId, id: { in: entityIds } },
      select: { id: true },
    })
    if (entities.length !== entityIds.length) {
      return NextResponse.json({ error: "One or more entity IDs are invalid" }, { status: 400 })
    }
  }

  // Check for duplicate email within tenant
  const existing = await prisma.hceUser.findFirst({
    where: { tenantId: session.tenantId, email },
  })
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 })
  }

  // Generate a temporary password if not provided
  const rawPassword = tempPassword ?? Math.random().toString(36).slice(2, 10) + "X1!"
  const passwordHash = await bcrypt.hash(rawPassword, 10)

  const user = await prisma.hceUser.create({
    data: {
      tenantId: session.tenantId,
      email,
      name: name ?? null,
      role: role as never,
      passwordHash,
      active: true,
      entityAccess: {
        create: (entityIds ?? []).map((eid) => ({ entityId: eid })),
      },
    },
    include: { entityAccess: true },
  })

  // Return the temp password once so it can be shown to the inviter
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tempPassword: rawPassword,
    entityAccess: user.entityAccess.map((a) => a.entityId),
  })
}
