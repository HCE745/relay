import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const sa = await prisma.superAdmin.findUnique({ where: { email } })
  if (!sa || !sa.isActive) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, sa.password)
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  await createSession({
    userId:        sa.id,
    email:         sa.email,
    name:          sa.name,
    role:          "SUPER_ADMIN",
    organizationId: "",
    superAdmin:    true,
    superAdminId:  sa.id,
  })

  return NextResponse.json({ success: true })
}
