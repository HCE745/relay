import "server-only"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age":       "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function resolveBase(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  }
  // x-forwarded-host is the real public hostname in Vercel/reverse-proxy setups
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost"
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  const base   = resolveBase(req)
  const server = `${base}/api/mcp`

  const metadata = {
    issuer:                               server,
    authorization_endpoint:               `${server}/oauth/authorize`,
    token_endpoint:                       `${server}/oauth/token`,
    registration_endpoint:                `${server}/oauth/register`,
    response_types_supported:             ["code"],
    grant_types_supported:                ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "none"],
    code_challenge_methods_supported:     ["S256"],
    scopes_supported:                     ["mcp"],
  }

  console.error("[mcp/oauth-metadata] NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
  console.error("[mcp/oauth-metadata] x-forwarded-host:", req.headers.get("x-forwarded-host"))
  console.error("[mcp/oauth-metadata] host:", req.headers.get("host"))
  console.error("[mcp/oauth-metadata] resolved base:", base)
  console.error("[mcp/oauth-metadata] registration_endpoint:", metadata.registration_endpoint)

  return NextResponse.json(metadata, { headers: CORS })
}
