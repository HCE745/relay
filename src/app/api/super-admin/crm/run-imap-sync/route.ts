import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { syncImapForConfig } from "@/lib/imap-sync"

export const maxDuration = 60

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function POST() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const config = await prisma.imapConfig.findUnique({
    where: { superAdminId: session.superAdminId! },
  })

  if (!config) {
    return NextResponse.json(
      { error: "No IMAP config found — save credentials in CRM Settings first" },
      { status: 404 },
    )
  }

  if (!config.enabled) {
    return NextResponse.json(
      { error: "IMAP sync is disabled — enable it in CRM Settings" },
      { status: 400 },
    )
  }

  const result = await syncImapForConfig(config.id)

  return NextResponse.json({
    fetched:  result.fetched,
    matched:  result.matched,
    saved:    result.synced,
    skipped:  result.skipped,
    errors:   result.errors,
  })
}
