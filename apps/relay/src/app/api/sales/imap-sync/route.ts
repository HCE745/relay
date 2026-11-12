import "server-only"
import { NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { syncImapForConfig } from "@/lib/imap-sync"

export const dynamic    = "force-dynamic"
export const maxDuration = 60

// POST /api/sales/imap-sync — manually trigger IMAP sync for the calling sales user.
// Sales reps can only sync their own mailbox. Super admins use /super-admin/crm/imap-sync.
export async function POST() {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (info.isSuperAdmin) return NextResponse.json({ error: "Super admins use /super-admin/crm/imap-sync" }, { status: 400 })

  const config = await prisma.imapConfig.findUnique({
    where:  { salesUserId: info.salesUserId },
    select: { id: true, enabled: true },
  })

  if (!config) return NextResponse.json({ error: "No IMAP configuration found — set one up in Settings → Email." }, { status: 404 })
  if (!config.enabled) return NextResponse.json({ error: "IMAP sync is disabled for your account." }, { status: 400 })

  const result = await syncImapForConfig(config.id)
  return NextResponse.json({ result })
}
