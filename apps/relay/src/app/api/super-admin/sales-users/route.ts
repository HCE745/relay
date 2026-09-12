import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.salesUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    name?: unknown; email?: unknown; password?: unknown; role?: unknown
  }

  const name     = typeof body.name     === "string" ? body.name.trim()     : ""
  const email    = typeof body.email    === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password        : ""
  const role     = body.role === "admin_sales" || body.role === "sales_rep" ? body.role : "sales_rep"

  if (!name)  return NextResponse.json({ error: "Name is required" },     { status: 400 })
  if (!email) return NextResponse.json({ error: "Email is required" },    { status: 400 })
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const existing = await prisma.salesUser.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.salesUser.create({
    data: { name, email, passwordHash, role, isActive: true },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json(user, { status: 201 })
}
