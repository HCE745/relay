import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { syncImapForConfig } from "@/lib/imap-sync"

export const maxDuration = 60

export async function POST() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const config = await prisma.imapConfig.findUnique({ where: { superAdminId: session.superAdminId! } })
  if (!config) return NextResponse.json({ error: "No IMAP config found — configure it in CRM Settings." }, { status: 404 })
  if (!config.enabled) return NextResponse.json({ error: "IMAP sync is disabled." }, { status: 400 })

  const result = await syncImapForConfig(config.id)
  return NextResponse.json({ result })
}
