import "server-only"
import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getPlatformConfig, setPlatformConfig } from "@/lib/platform-config"
import { encryptToken } from "@/lib/connected-account-crypto"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(`${APP_URL}/login`)

  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/settings/integrations?error=google_oauth_${error ?? "missing_params"}`)
  }

  // Validate state
  const storedRaw = await getPlatformConfig(`google_oauth_state_${session.organizationId}`)
  if (!storedRaw) {
    return NextResponse.redirect(`${APP_URL}/settings/integrations?error=google_oauth_state_missing`)
  }

  let stored: { state: string; orgId: string; expiry: number }
  try { stored = JSON.parse(storedRaw) } catch {
    return NextResponse.redirect(`${APP_URL}/settings/integrations?error=google_oauth_state_invalid`)
  }

  if (stored.state !== state || stored.orgId !== session.organizationId || stored.expiry < Date.now()) {
    return NextResponse.redirect(`${APP_URL}/settings/integrations?error=google_oauth_state_mismatch`)
  }

  // Clean up state
  await setPlatformConfig(`google_oauth_state_${session.organizationId}`, "")

  const clientId     = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI ?? `${APP_URL}/api/integrations/google/callback`

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  })

  if (!tokenRes.ok) {
    console.error("[google/callback] token exchange failed:", await tokenRes.text())
    return NextResponse.redirect(`${APP_URL}/settings/integrations?error=google_oauth_token_exchange`)
  }

  const tokens = await tokenRes.json() as {
    access_token:  string
    refresh_token: string
    expires_in:    number
    scope:         string
  }

  // Get connected account email
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userInfoRes.ok) {
    return NextResponse.redirect(`${APP_URL}/settings/integrations?error=google_oauth_userinfo`)
  }

  const userInfo = await userInfoRes.json() as { id: string; email: string }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
  const scopes    = tokens.scope.split(" ")

  await prisma.connectedAccount.upsert({
    where:  { organizationId_provider: { organizationId: session.organizationId, provider: "google_business_profile" } },
    create: {
      organizationId: session.organizationId,
      provider:       "google_business_profile",
      accountEmail:   userInfo.email,
      accountId:      userInfo.id,
      accessToken:    encryptToken(tokens.access_token),
      refreshToken:   encryptToken(tokens.refresh_token),
      expiresAt,
      scopes,
      connectedById:  session.userId,
    },
    update: {
      accountEmail: userInfo.email,
      accountId:    userInfo.id,
      accessToken:  encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      expiresAt,
      scopes,
      connectedById: session.userId,
    },
  })

  return NextResponse.redirect(`${APP_URL}/settings/integrations?connected=google`)
}
