import "server-only"
import { NextResponse } from "next/server"
import { deleteSession } from "@/lib/session"

export const dynamic = "force-dynamic"

// POST /api/auth/logout
//
// Clears the session cookie. Used by the kiosk dashboard and other clients
// that need to log out programmatically without a full page redirect.
export async function POST() {
  await deleteSession()
  return NextResponse.json({ ok: true })
}
