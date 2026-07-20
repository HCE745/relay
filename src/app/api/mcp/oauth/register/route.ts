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

// Dynamic Client Registration (RFC 7591) — open, no auth required
export async function POST(req: NextRequest) {
  console.error("[mcp/register] --- DCR request ---")
  console.error("[mcp/register] headers:", JSON.stringify(Object.fromEntries(req.headers)))

  let body: Record<string, unknown> = {}
  try { body = await req.json() as Record<string, unknown> } catch { /* no body or non-JSON */ }
  console.error("[mcp/register] body:", JSON.stringify(body))

  // Capture redirect_uris the client intends to use
  const redirectUris: string[] = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter((u): u is string => typeof u === "string")
    : []
  console.error("[mcp/register] redirect_uris:", redirectUris)

  const clientId     = crypto.randomUUID()
  const clientSecret = crypto.randomBytes(32).toString("base64url")
  const issuedAt     = Math.floor(Date.now() / 1000)

  const stored = { client_secret: clientSecret, issued_at: issuedAt, redirect_uris: redirectUris }
  await setPlatformConfig(`mcp_client_${clientId}`, JSON.stringify(stored))
  console.error("[mcp/register] stored client_id:", clientId)

  const response = {
    client_id:                  clientId,
    client_secret:              clientSecret,
    client_id_issued_at:        issuedAt,
    token_endpoint_auth_method: "client_secret_basic",
    redirect_uris:              redirectUris,
  }
  console.error("[mcp/register] response:", JSON.stringify(response))
  return NextResponse.json(response, { status: 201, headers: CORS })
}
