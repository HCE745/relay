import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.salesUser.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, isActive: true,
      imapConfig: {
        select: {
          emailAddress: true, host: true, port: true,
          smtpHost: true, smtpPort: true, enabled: true,
          lastSyncAt: true, encryptedPassword: true,
        },
      },
    },
  })

  return NextResponse.json(
    users.map(u => ({
      id:       u.id,
      name:     u.name,
      email:    u.email,
      isActive: u.isActive,
      mailbox:  u.imapConfig
        ? {
            emailAddress: u.imapConfig.emailAddress,
            host:         u.imapConfig.host,
            port:         u.imapConfig.port,
            smtpHost:     u.imapConfig.smtpHost,
            smtpPort:     u.imapConfig.smtpPort,
            enabled:      u.imapConfig.enabled,
            lastSyncAt:   u.imapConfig.lastSyncAt?.toISOString() ?? null,
            hasPassword:  u.imapConfig.encryptedPassword.length > 0,
          }
        : null,
    }))
  )
}
