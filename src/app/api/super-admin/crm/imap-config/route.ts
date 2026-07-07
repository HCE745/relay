import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { encryptField } from "@/lib/crypto-utils"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function GET() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const config = await prisma.imapConfig.findUnique({
    where:  { superAdminId: session.superAdminId! },
    select: { id: true, host: true, port: true, emailAddress: true, lastSyncAt: true, enabled: true, updatedAt: true },
  })

  return NextResponse.json({ config })
}

export async function POST(req: NextRequest) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { host, port, emailAddress, password, enabled } = await req.json() as {
    host?:         string
    port?:         number
    emailAddress:  string
    password?:     string
    enabled?:      boolean
  }

  if (!emailAddress) return NextResponse.json({ error: "emailAddress required" }, { status: 400 })

  const existing = await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId! } })

  if (existing) {
    const updateData: Record<string, unknown> = {
      host:         host ?? existing.host,
      port:         port ?? existing.port,
      emailAddress: emailAddress.trim(),
      enabled:      enabled ?? existing.enabled,
    }
    if (password) {
      updateData.encryptedPassword = encryptField(password)
    }
    const config = await prisma.imapConfig.update({
      where: { superAdminId: session.superAdminId! },
      data:  updateData,
    })
    return NextResponse.json({ config: { ...config, encryptedPassword: undefined } })
  }

  if (!password) return NextResponse.json({ error: "password required for new config" }, { status: 400 })

  const config = await prisma.imapConfig.create({
    data: {
      superAdminId:      session.superAdminId!,
      host:              host ?? "imap.titan.email",
      port:              port ?? 993,
      emailAddress:      emailAddress.trim(),
      encryptedPassword: encryptField(password),
      enabled:           enabled ?? true,
    },
  })

  return NextResponse.json({ config: { ...config, encryptedPassword: undefined } })
}

export async function DELETE() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.imapConfig.deleteMany({ where: { superAdminId: session.superAdminId! } })
  return NextResponse.json({ ok: true })
}
