import { NextRequest, NextResponse } from "next/server"
import { syncAllImapConfigs } from "@/lib/imap-sync"

export const dynamic    = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret || auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = await syncAllImapConfigs()
  const total   = Object.values(results).reduce((sum, r) => ({ synced: sum.synced + r.synced, skipped: sum.skipped + r.skipped }), { synced: 0, skipped: 0 })

  return NextResponse.json({ ok: true, configs: Object.keys(results).length, ...total })
}
