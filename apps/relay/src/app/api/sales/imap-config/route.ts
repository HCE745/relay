export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { encryptField } from "@/lib/crypto-utils"

export async function GET() {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isSuperAdmin) return NextResponse.json(null) // SA manages via /super-admin

  const config = await prisma.imapConfig.findUnique({
    where: { salesUserId: info.salesUserId },
    select: {
      id:           true,
      host:         true,
      port:         true,
      emailAddress: true,
      smtpHost:     true,
      smtpPort:     true,
      enabled:      true,
      lastSyncAt:   true,
      salesUserId:  true,
    },
  })

  return NextResponse.json(config ?? null)
}

export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isSuperAdmin) return NextResponse.json({ error: "Super Admins use /super-admin/crm/imap" }, { status: 400 })

  const body = await req.json() as {
    host:         string
    port:         number
    emailAddress: string
    password:     string
    smtpHost:     string
    smtpPort:     number
  }

  const { host, port, emailAddress, password, smtpHost, smtpPort } = body
  if (!host || !port || !emailAddress || !password) {
    return NextResponse.json({ error: "host, port, emailAddress, and password are required" }, { status: 400 })
  }

  const encryptedPassword = encryptField(password)

  const config = await prisma.imapConfig.upsert({
    where:  { salesUserId: info.salesUserId },
    create: { host, port, emailAddress, encryptedPassword, smtpHost: smtpHost || "smtp.titan.email", smtpPort: smtpPort || 465, salesUserId: info.salesUserId },
    update: { host, port, emailAddress, encryptedPassword, smtpHost: smtpHost || "smtp.titan.email", smtpPort: smtpPort || 465 },
    select: { id: true, host: true, port: true, emailAddress: true, smtpHost: true, smtpPort: true, enabled: true, salesUserId: true },
  })

  return NextResponse.json(config)
}

export async function DELETE() {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isSuperAdmin) return NextResponse.json({ error: "Super Admins use /super-admin/crm/imap" }, { status: 400 })

  await prisma.imapConfig.deleteMany({ where: { salesUserId: info.salesUserId } })
  return NextResponse.json({ ok: true })
}
