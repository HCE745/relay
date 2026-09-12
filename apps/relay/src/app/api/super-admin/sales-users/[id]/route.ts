import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    action?: unknown; isActive?: unknown; password?: unknown; role?: unknown; name?: unknown
  }

  const user = await prisma.salesUser.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // action: "deactivate" | "reactivate" | "reset_password" — or plain field patch
  const action = typeof body.action === "string" ? body.action : null

  if (action === "deactivate") {
    const updated = await prisma.salesUser.update({
      where:  { id },
      data:   { isActive: false },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json(updated)
  }

  if (action === "reactivate") {
    const updated = await prisma.salesUser.update({
      where:  { id },
      data:   { isActive: true },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json(updated)
  }

  if (action === "reset_password") {
    const password = typeof body.password === "string" ? body.password : ""
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const updated = await prisma.salesUser.update({
      where:  { id },
      data:   { passwordHash },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json(updated)
  }

  // Generic field patch (name, role)
  const data: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (body.role === "admin_sales" || body.role === "sales_rep") data.role = body.role
  if (typeof body.isActive === "boolean") data.isActive = body.isActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const updated = await prisma.salesUser.update({
    where:  { id },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const user = await prisma.salesUser.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await prisma.salesUser.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
