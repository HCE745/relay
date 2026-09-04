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
    select: {
      id: true, host: true, port: true, smtpHost: true, smtpPort: true,
      emailAddress: true, lastSyncAt: true, lastSyncEmailCount: true,
      enabled: true, updatedAt: true,
    },
  })

  return NextResponse.json({ config })
}

export async function POST(req: NextRequest) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { host, port, smtpHost, smtpPort, emailAddress, password, enabled } = await req.json() as {
    host?:         string
    port?:         number
    smtpHost?:     string
    smtpPort?:     number
    emailAddress:  string
    password?:     string
    enabled?:      boolean
  }

  if (!emailAddress) return NextResponse.json({ error: "emailAddress required" }, { status: 400 })

  const existing = await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId! } })

  let savedConfig
  if (existing) {
    const updateData: Record<string, unknown> = {
      host:         host     ?? existing.host,
      port:         port     ?? existing.port,
      smtpHost:     smtpHost ?? existing.smtpHost,
      smtpPort:     smtpPort ?? existing.smtpPort,
      emailAddress: emailAddress.trim(),
      enabled:      enabled  ?? existing.enabled,
    }
    if (password) updateData.encryptedPassword = encryptField(password)
    savedConfig = await prisma.imapConfig.update({
      where: { superAdminId: session.superAdminId! },
      data:  updateData,
    })
  } else {
    if (!password) return NextResponse.json({ error: "password required for new config" }, { status: 400 })
    savedConfig = await prisma.imapConfig.create({
      data: {
        superAdminId:      session.superAdminId!,
        host:              host     ?? "imap.titan.email",
        port:              port     ?? 993,
        smtpHost:          smtpHost ?? "smtp.titan.email",
        smtpPort:          smtpPort ?? 465,
        emailAddress:      emailAddress.trim(),
        encryptedPassword: encryptField(password),
        enabled:           enabled ?? true,
      },
    })
  }

  const safeConfig = { ...savedConfig, encryptedPassword: undefined }

  return NextResponse.json({ config: safeConfig, syncTriggered: false })
}

export async function PATCH(req: NextRequest) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { resetSyncHistory?: boolean }

  if (body.resetSyncHistory) {
    await prisma.imapConfig.updateMany({
      where: { superAdminId: session.superAdminId! },
      data:  { lastSyncAt: null, lastSyncEmailCount: 0 },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export async function DELETE() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.imapConfig.deleteMany({ where: { superAdminId: session.superAdminId! } })
  return NextResponse.json({ ok: true })
}
