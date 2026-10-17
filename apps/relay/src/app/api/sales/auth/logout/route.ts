import { NextResponse } from "next/server"
import { deleteSession, getSession } from "@/lib/session"
import { closeSalesSession } from "@/lib/sales-activity"

export async function POST() {
  const session = await getSession()
  if (session?.salesUserId) {
    closeSalesSession(session.salesUserId).catch(() => {})
  }
  await deleteSession()
  return NextResponse.json({ ok: true })
}
