export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSalesSession } from "@/lib/sales-auth"

export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Super admins have a separate auth path — they don't have a SalesUser record
  if (info.isSuperAdmin) {
    return NextResponse.json({ error: "Use the super-admin password settings" }, { status: 400 })
  }

  const body = await req.json() as {
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword     = typeof body.newPassword     === "string" ? body.newPassword     : ""
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : ""

  if (!currentPassword) return NextResponse.json({ error: "Current password is required" }, { status: 400 })
  if (!newPassword)      return NextResponse.json({ error: "New password is required" },     { status: 400 })
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "New passwords do not match" }, { status: 400 })
  }

  const user = await prisma.salesUser.findUnique({
    where:  { id: info.salesUserId },
    select: { passwordHash: true, isActive: true },
  })

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account not found or deactivated" }, { status: 403 })
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.salesUser.update({ where: { id: info.salesUserId }, data: { passwordHash } })

  return NextResponse.json({ ok: true })
}
