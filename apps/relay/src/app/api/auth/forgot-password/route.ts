import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail, passwordResetEmail } from "@/lib/email"
import { checkLimit, getIP, limiters } from "@/lib/ratelimit"

export async function POST(request: NextRequest) {
  const blocked = await checkLimit(
    limiters.forgotPw,
    `forgot-pw:${getIP(request)}`,
    "Too many password reset requests. Please try again in an hour.",
  )
  if (blocked) return blocked

  const { email } = await request.json()

  // Always return success to avoid leaking user existence
  if (!email) return NextResponse.json({ ok: true })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ ok: true })

  // Invalidate any existing tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

  const token     = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  })

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"
  const resetUrl = `${appUrl}/reset-password?token=${token}`

  sendEmail({
    to:      user.email,
    subject: "Reset your Relay password",
    html:    passwordResetEmail({ name: user.name, resetUrl }),
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
