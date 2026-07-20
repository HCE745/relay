import "server-only"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getPlatformConfig, setPlatformConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

interface AuthCodeData {
  redirect_uri:          string
  client_id:             string
  code_challenge:        string
  code_challenge_method: string
  expiry:                number
}

interface ClientRecord {
  client_secret: string
  issued_at:     number
}

function verifyPKCE(verifier: string, challenge: string, method: string): boolean {
  if (method === "S256") {
    const hash     = crypto.createHash("sha256").update(verifier).digest()
    const computed = Buffer.from(hash).toString("base64url")
    return computed === challenge
  }
  return method === "plain" && verifier === challenge
}

function generateToken(clientId: string, key: string): string {
  const payload = Buffer.from(JSON.stringify({ cid: clientId, iat: Date.now() })).toString("base64url")
  const sig     = crypto.createHmac("sha256", key).update(payload).digest("hex")
  return `mcp.${payload}.${sig}`
}

function tokenError(code: string, description: string, status = 400) {
  return NextResponse.json({ error: code, error_description: description }, { status, headers: CORS })
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const mcpKey = process.env.MCP_API_KEY
  if (!mcpKey) {
    return NextResponse.json({ error: "MCP_API_KEY not configured" }, { status: 500, headers: CORS })
  }

  // ── Client authentication via client_secret_basic ──────────────────────────
  // If Authorization: Basic header is present, validate registered client credentials.
  // If absent, fall through — PKCE alone provides security for unregistered clients.
  let authenticatedClientId: string | null = null

  const authHeader = req.headers.get("authorization") ?? ""
  if (authHeader.startsWith("Basic ")) {
    let rawClientId: string, rawClientSecret: string
    try {
      const decoded  = Buffer.from(authHeader.slice(6), "base64").toString("utf-8")
      const colonIdx = decoded.indexOf(":")
      if (colonIdx === -1) throw new Error("no colon")
      // RFC 6749 §2.3.1 — client_id and secret may be form-encoded
      rawClientId     = decodeURIComponent(decoded.slice(0, colonIdx))
      rawClientSecret = decodeURIComponent(decoded.slice(colonIdx + 1))
    } catch {
      return tokenError("invalid_client", "Cannot decode Basic authentication credentials")
    }

    const clientRaw = await getPlatformConfig(`mcp_client_${rawClientId}`)
    if (!clientRaw) return tokenError("invalid_client", "Unknown client_id", 401)

    let clientRecord: ClientRecord
    try { clientRecord = JSON.parse(clientRaw) as ClientRecord }
    catch { return tokenError("invalid_client", "Malformed client record", 401) }

    if (clientRecord.client_secret !== rawClientSecret) {
      return tokenError("invalid_client", "Invalid client credentials", 401)
    }

    authenticatedClientId = rawClientId
  }

  // ── Parse request body ─────────────────────────────────────────────────────
  let params: URLSearchParams
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/x-www-form-urlencoded")) {
    params = new URLSearchParams(await req.text())
  } else {
    try {
      const body = await req.json() as Record<string, string>
      params = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]))
    } catch {
      return tokenError("invalid_request", "Cannot parse request body")
    }
  }

  const grantType    = params.get("grant_type")    ?? ""
  const code         = params.get("code")          ?? ""
  const redirectUri  = params.get("redirect_uri")  ?? ""
  const bodyClientId = params.get("client_id")     ?? ""
  const codeVerifier = params.get("code_verifier") ?? ""

  if (grantType !== "authorization_code") {
    return tokenError("unsupported_grant_type", "Only authorization_code is supported")
  }
  if (!code) return tokenError("invalid_request", "Missing required parameter: code")

  // ── Retrieve and validate stored auth code ─────────────────────────────────
  const raw = await getPlatformConfig(`mcp_authcode_${code}`)
  if (!raw) {
    return tokenError("invalid_grant", "Authorization code not found, expired, or already used")
  }

  let codeData: AuthCodeData
  try { codeData = JSON.parse(raw) as AuthCodeData }
  catch { return tokenError("invalid_grant", "Malformed authorization code") }

  if (codeData.expiry < Date.now()) {
    await setPlatformConfig(`mcp_authcode_${code}`, "")
    return tokenError("invalid_grant", "Authorization code has expired")
  }

  // One-time use — consume before any further checks
  await setPlatformConfig(`mcp_authcode_${code}`, "")

  // client_id must match what was used during authorization
  const effectiveClientId = authenticatedClientId ?? bodyClientId
  if (effectiveClientId && codeData.client_id && effectiveClientId !== codeData.client_id) {
    return tokenError("invalid_grant", "client_id does not match the authorization request")
  }

  // redirect_uri must match if both sides provide it
  if (redirectUri && codeData.redirect_uri && redirectUri !== codeData.redirect_uri) {
    return tokenError("invalid_grant", "redirect_uri does not match the one used during authorization")
  }

  // PKCE verification
  if (codeData.code_challenge) {
    if (!codeVerifier) {
      return tokenError("invalid_request", "Missing required parameter: code_verifier")
    }
    if (!verifyPKCE(codeVerifier, codeData.code_challenge, codeData.code_challenge_method ?? "S256")) {
      return tokenError("invalid_grant", "PKCE code_verifier does not match code_challenge")
    }
  }

  const finalClientId = effectiveClientId || codeData.client_id
  const accessToken   = generateToken(finalClientId, mcpKey)

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type:   "Bearer",
      expires_in:   31_536_000, // 1 year
      scope:        "mcp",
    },
    { headers: CORS },
  )
}
