import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { sendEmail, passwordChangedEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  const { token, newPassword } = await request.json()

  if (!token || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Token and password (min 8 chars) are required" }, { status: 400 })
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  if (!record)            return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
  if (record.usedAt)      return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 })
  if (record.expiresAt < new Date()) return NextResponse.json({ error: "This reset link has expired" }, { status: 400 })

  const hashed = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  const changedAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long", timeStyle: "short",
  }).format(new Date())

  sendEmail({
    to:      record.user.email,
    subject: "Your Relay password was changed",
    html:    passwordChangedEmail({ name: record.user.name, changedAt }),
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
