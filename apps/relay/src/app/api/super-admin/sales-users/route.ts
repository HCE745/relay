import { NextRequest, NextResponse } from "next/server"
import { randomBytes, createHash } from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { sendEmail, salesCrmInviteEmail } from "@/lib/email"
import { encryptField } from "@/lib/crypto-utils"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.salesUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, invitePending: true, createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    name?: unknown; email?: unknown; password?: unknown; role?: unknown
    imapPassword?: unknown; imapEmail?: unknown
    imapHost?: unknown; imapPort?: unknown; smtpHost?: unknown; smtpPort?: unknown
  }

  const name     = typeof body.name  === "string" ? body.name.trim()               : ""
  const email    = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""
  const role     = body.role === "admin_sales" || body.role === "sales_rep" ? body.role : "sales_rep"

  // Optional email account credentials (admin pre-configures on behalf of the user)
  const imapPassword = typeof body.imapPassword === "string" ? body.imapPassword.trim() : ""
  const imapEmail    = typeof body.imapEmail    === "string" ? body.imapEmail.trim().toLowerCase() : email
  const imapHost     = typeof body.imapHost     === "string" ? body.imapHost.trim()  : "imap.titan.email"
  const imapPort     = typeof body.imapPort     === "number" ? body.imapPort         : 993
  const smtpHost     = typeof body.smtpHost     === "string" ? body.smtpHost.trim()  : "smtp.titan.email"
  const smtpPort     = typeof body.smtpPort     === "number" ? body.smtpPort         : 465

  if (!name)  return NextResponse.json({ error: "Name is required" },  { status: 400 })
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

  const existing = await prisma.salesUser.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 })

  // ── Path A: password provided — create active account directly ──────────────
  if (password) {
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.salesUser.create({
      data: { name, email, passwordHash, role, isActive: true, invitePending: false },
      select: { id: true, email: true, name: true, role: true, isActive: true, invitePending: true, createdAt: true, updatedAt: true },
    })
    if (imapPassword) {
      await prisma.imapConfig.create({
        data: {
          salesUserId:       user.id,
          emailAddress:      imapEmail,
          encryptedPassword: encryptField(imapPassword),
          host:              imapHost,
          port:              imapPort,
          smtpHost,
          smtpPort,
        },
      })
    }
    return NextResponse.json(user, { status: 201 })
  }

  // ── Path B: no password — create pending account + send invitation ──────────
  const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12)

  const user = await prisma.salesUser.create({
    data: { name, email, passwordHash: placeholderHash, role, isActive: false, invitePending: true },
    select: { id: true, email: true, name: true, role: true, isActive: true, invitePending: true, createdAt: true, updatedAt: true },
  })

  if (imapPassword) {
    await prisma.imapConfig.create({
      data: {
        salesUserId:       user.id,
        emailAddress:      imapEmail,
        encryptedPassword: encryptField(imapPassword),
        host:              imapHost,
        port:              imapPort,
        smtpHost,
        smtpPort,
      },
    })
  }

  await sendInvite(user.id, name, email)

  return NextResponse.json({ ...user, inviteSent: true }, { status: 201 })
}

// ── Shared invite helper (also called from the resend action) ─────────────────
export async function sendInvite(salesUserId: string, name: string, email: string) {
  // Invalidate any prior unused tokens for this user
  await prisma.salesUserInvite.deleteMany({ where: { salesUserId } })

  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.salesUserInvite.create({
    data: { salesUserId, tokenHash, expiresAt },
  })

  const inviteUrl = `${APP_URL}/sales/invite?token=${rawToken}`

  sendEmail({
    to: email,
    subject: "You've been invited to Relay Sales CRM — set your password",
    html: salesCrmInviteEmail({ name, inviteUrl }),
  }).catch(err => console.error("[sales-invite] email send failed:", err))
}
