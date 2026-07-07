import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, email, password } = await req.json() as {
    name: string; email: string; password: string
  }

  if (!name || !email || !password || password.length < 8) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const existing = await prisma.superAdmin.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const admin = await prisma.superAdmin.create({
    data: {
      name,
      email,
      password: hashed,
      createdById: session.superAdminId ?? null,
    },
  })

  return NextResponse.json({ id: admin.id }, { status: 201 })
}
