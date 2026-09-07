import "server-only"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/session"
import { setPlatformConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

const SCOPES = ["https://www.googleapis.com/auth/business.manage"]

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin required" }, { status: 403 })

  const clientId    = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`

  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 })

  const state = randomUUID()
  const expiry = Date.now() + 10 * 60 * 1000 // 10 minutes

  await setPlatformConfig(
    `google_oauth_state_${session.organizationId}`,
    JSON.stringify({ state, orgId: session.organizationId, expiry })
  )

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES.join(" "),
    access_type:   "offline",
    prompt:        "consent",
    state,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
