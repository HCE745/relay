import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import type { PageKey } from "@/lib/page-access"

// PATCH /api/employee-types/:id — update an employee type
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const type = await prisma.employeeType.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.employeeType.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.baseRole !== undefined && { baseRole: body.baseRole }),
      ...(body.pageAccess !== undefined && { pageAccess: body.pageAccess as PageKey[] }),
      ...(body.actions !== undefined && { actions: Array.isArray(body.actions) ? body.actions : [] }),
      ...(body.canInvite !== undefined && { canInvite: body.canInvite }),
      ...(body.canChangeEmail !== undefined && { canChangeEmail: body.canChangeEmail }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/employee-types/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const type = await prisma.employeeType.findFirst({
    where: { id, organizationId: session.organizationId },
    include: { _count: { select: { users: true } } },
  })
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (type._count.users > 0) {
    return NextResponse.json({ error: `Cannot delete — ${type._count.users} employee(s) use this type` }, { status: 409 })
  }

  await prisma.employeeType.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
