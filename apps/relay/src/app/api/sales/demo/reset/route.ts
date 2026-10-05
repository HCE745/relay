export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { clearDemoData, seedDemoData } from "@/lib/sales-demo-seed"

export async function POST() {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!info.isDemo) return NextResponse.json({ error: "Not a demo account" }, { status: 403 })

  try {
    await clearDemoData(info.salesUserId)
    await seedDemoData(info.salesUserId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Demo reset failed:", e)
    return NextResponse.json({ error: "Reset failed" }, { status: 500 })
  }
}
