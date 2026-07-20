import "server-only"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")) ?? `${proto}://${host}`
  const server = `${base}/api/mcp`

  return NextResponse.json(
    {
      issuer:                               server,
      authorization_endpoint:               `${server}/oauth/authorize`,
      token_endpoint:                       `${server}/oauth/token`,
      response_types_supported:             ["code"],
      grant_types_supported:                ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported:     ["S256"],
      scopes_supported:                     ["mcp"],
    },
    { headers: CORS },
  )
}
