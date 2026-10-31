export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

// GET /api/sales/invite?token=xxx
// Returns the invite's name/email so the page can prefill and validate before the form is submitted.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? ""
  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 })

  const invite = await prisma.salesUserInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { salesUser: { select: { name: true, email: true, invitePending: true } } },
  })

  if (!invite)                      return NextResponse.json({ error: "Invalid invitation link" },          { status: 404 })
  if (invite.usedAt)                return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 })
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "This invitation has expired" },     { status: 410 })
  if (!invite.salesUser.invitePending) return NextResponse.json({ error: "Account is already active" },    { status: 409 })

  return NextResponse.json({ name: invite.salesUser.name, email: invite.salesUser.email })
}

// POST /api/sales/invite
// Validates the token and sets the user's password, activating their account.
export async function POST(req: NextRequest) {
  const body = await req.json() as { token?: string; password?: string; confirmPassword?: string }

  const token    = typeof body.token    === "string" ? body.token.trim()    : ""
  const password = typeof body.password === "string" ? body.password        : ""
  const confirm  = typeof body.confirmPassword === "string" ? body.confirmPassword : ""

  if (!token)    return NextResponse.json({ error: "Token is required" },            { status: 400 })
  if (!password) return NextResponse.json({ error: "Password is required" },         { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  if (password !== confirm) return NextResponse.json({ error: "Passwords do not match" },              { status: 400 })

  const invite = await prisma.salesUserInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { salesUser: { select: { id: true, name: true, email: true, invitePending: true } } },
  })

  if (!invite)                        return NextResponse.json({ error: "Invalid invitation link" },          { status: 404 })
  if (invite.usedAt)                  return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 })
  if (invite.expiresAt < new Date())   return NextResponse.json({ error: "This invitation has expired — ask your administrator to resend the invitation" }, { status: 410 })
  if (!invite.salesUser.invitePending) return NextResponse.json({ error: "Account is already active" },      { status: 409 })

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction([
    prisma.salesUser.update({
      where: { id: invite.salesUserId },
      data:  { passwordHash, isActive: true, invitePending: false },
    }),
    prisma.salesUserInvite.update({
      where: { id: invite.id },
      data:  { usedAt: new Date() },
    }),
  ])

  return NextResponse.json({ ok: true, email: invite.salesUser.email })
}
