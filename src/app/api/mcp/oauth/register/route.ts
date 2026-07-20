import "server-only"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { setPlatformConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// Dynamic Client Registration (RFC 7591) — no auth required, accept any client
export async function POST(_req: NextRequest) {
  const clientId     = crypto.randomUUID()
  const clientSecret = crypto.randomBytes(32).toString("base64url")
  const issuedAt     = Math.floor(Date.now() / 1000)

  await setPlatformConfig(
    `mcp_client_${clientId}`,
    JSON.stringify({ client_secret: clientSecret, issued_at: issuedAt }),
  )

  return NextResponse.json(
    {
      client_id:                  clientId,
      client_secret:              clientSecret,
      client_id_issued_at:        issuedAt,
      token_endpoint_auth_method: "client_secret_basic",
    },
    { status: 201, headers: CORS },
  )
}
