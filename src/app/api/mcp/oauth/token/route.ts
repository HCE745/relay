import "server-only"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getPlatformConfig, setPlatformConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

const ACCESS_TOKEN_TTL_MS  = 3_600_000          // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 86_400_000    // 30 days

interface AuthCodeData {
  redirect_uri:          string
  client_id:             string
  code_challenge:        string
  code_challenge_method: string
  expiry:                number
}

interface ClientRecord {
  client_secret:  string
  issued_at:      number
  redirect_uris?: string[]
}

interface RefreshRecord {
  client_id: string
  exp:       number  // ms epoch
}

function verifyPKCE(verifier: string, challenge: string, method: string): boolean {
  if (method === "S256") {
    const hash     = crypto.createHash("sha256").update(verifier).digest()
    const computed = Buffer.from(hash).toString("base64url")
    return computed === challenge
  }
  return method === "plain" && verifier === challenge
}

function generateAccessToken(clientId: string, key: string): string {
  const now     = Date.now()
  const exp     = now + ACCESS_TOKEN_TTL_MS
  const payload = Buffer.from(JSON.stringify({ cid: clientId, iat: now, exp })).toString("base64url")
  const sig     = crypto.createHmac("sha256", key).update(payload).digest("hex")
  return `mcp.${payload}.${sig}`
}

async function generateRefreshToken(clientId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString("base64url")
  const record: RefreshRecord = { client_id: clientId, exp: Date.now() + REFRESH_TOKEN_TTL_MS }
  await setPlatformConfig(`mcp_refresh_${token}`, JSON.stringify(record))
  return token
}

function tokenError(code: string, description: string, status = 400) {
  console.error("[mcp/token] error:", code, "-", description)
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
  console.error("[mcp/token] --- token request ---")
  console.error("[mcp/token] headers:", JSON.stringify(Object.fromEntries(req.headers)))

  const mcpKey = process.env.MCP_API_KEY
  if (!mcpKey) {
    return NextResponse.json({ error: "MCP_API_KEY not configured" }, { status: 500, headers: CORS })
  }

  // ── Client authentication: client_secret_basic ────────────────────────────
  let authenticatedClientId: string | null = null

  const authHeader = req.headers.get("authorization") ?? ""
  console.error("[mcp/token] Authorization header:", authHeader ? "(present)" : "(absent)")

  if (authHeader.startsWith("Basic ")) {
    let rawClientId: string, rawClientSecret: string
    try {
      const decoded  = Buffer.from(authHeader.slice(6), "base64").toString("utf-8")
      const colonIdx = decoded.indexOf(":")
      if (colonIdx === -1) throw new Error("no colon")
      rawClientId     = decodeURIComponent(decoded.slice(0, colonIdx))
      rawClientSecret = decodeURIComponent(decoded.slice(colonIdx + 1))
    } catch {
      return tokenError("invalid_client", "Cannot decode Basic authentication credentials")
    }

    console.error("[mcp/token] client_id from Basic auth:", rawClientId)

    const clientRaw = await getPlatformConfig(`mcp_client_${rawClientId}`)
    if (!clientRaw) return tokenError("invalid_client", `Unknown client_id: ${rawClientId}`, 401)

    let clientRecord: ClientRecord
    try { clientRecord = JSON.parse(clientRaw) as ClientRecord }
    catch { return tokenError("invalid_client", "Malformed client record", 401) }

    if (clientRecord.client_secret !== rawClientSecret) {
      return tokenError("invalid_client", "Invalid client_secret", 401)
    }

    authenticatedClientId = rawClientId
    console.error("[mcp/token] client authenticated:", rawClientId)
  }

  // ── Parse request body ─────────────────────────────────────────────────────
  let body: string
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("text/plain")) {
    body = await req.text()
  } else {
    body = await req.text() // read regardless; try form parse first
  }

  let params: URLSearchParams
  try {
    params = new URLSearchParams(body)
  } catch {
    try {
      const json = JSON.parse(body) as Record<string, string>
      params = new URLSearchParams(Object.entries(json).map(([k, v]) => [k, String(v)]))
    } catch {
      return tokenError("invalid_request", "Cannot parse request body")
    }
  }

  const grantType    = params.get("grant_type")    ?? ""
  const bodyClientId = params.get("client_id")     ?? ""

  console.error("[mcp/token] grant_type:", grantType, "body client_id:", bodyClientId)
  console.error("[mcp/token] body:", body.slice(0, 500))

  // ── Grant: refresh_token ───────────────────────────────────────────────────
  if (grantType === "refresh_token") {
    const refreshToken = params.get("refresh_token") ?? ""
    console.error("[mcp/token] refresh_token present:", !!refreshToken)

    if (!refreshToken) return tokenError("invalid_request", "Missing refresh_token")

    const raw = await getPlatformConfig(`mcp_refresh_${refreshToken}`)
    if (!raw) return tokenError("invalid_grant", "Refresh token not found or already used")

    let record: RefreshRecord
    try { record = JSON.parse(raw) as RefreshRecord }
    catch { return tokenError("invalid_grant", "Malformed refresh token") }

    if (record.exp < Date.now()) {
      await setPlatformConfig(`mcp_refresh_${refreshToken}`, "")
      return tokenError("invalid_grant", "Refresh token has expired")
    }

    // Validate client matches if authenticated
    const clientId = (authenticatedClientId ?? bodyClientId) || record.client_id
    if (authenticatedClientId && record.client_id && authenticatedClientId !== record.client_id) {
      return tokenError("invalid_grant", "client_id does not match refresh token")
    }

    // Rotate: consume old token, issue new pair
    await setPlatformConfig(`mcp_refresh_${refreshToken}`, "")

    const accessToken  = generateAccessToken(clientId, mcpKey)
    const newRefresh   = await generateRefreshToken(clientId)

    console.error("[mcp/token] refresh_token grant success for client:", clientId)

    return NextResponse.json(
      {
        access_token:  accessToken,
        token_type:    "Bearer",
        expires_in:    3600,
        refresh_token: newRefresh,
        scope:         "mcp",
      },
      { headers: CORS },
    )
  }

  // ── Grant: authorization_code ──────────────────────────────────────────────
  if (grantType !== "authorization_code") {
    return tokenError("unsupported_grant_type", "Supported grant types: authorization_code, refresh_token")
  }

  const code         = params.get("code")          ?? ""
  const redirectUri  = params.get("redirect_uri")  ?? ""
  const codeVerifier = params.get("code_verifier") ?? ""

  console.error("[mcp/token] code present:", !!code, "redirect_uri:", redirectUri, "code_verifier present:", !!codeVerifier)

  if (!code) return tokenError("invalid_request", "Missing required parameter: code")

  // Retrieve and validate auth code
  const raw = await getPlatformConfig(`mcp_authcode_${code}`)
  console.error("[mcp/token] auth code found in store:", !!raw)

  if (!raw) return tokenError("invalid_grant", "Authorization code not found, expired, or already used")

  let codeData: AuthCodeData
  try { codeData = JSON.parse(raw) as AuthCodeData }
  catch { return tokenError("invalid_grant", "Malformed authorization code") }

  console.error("[mcp/token] code data:", { client_id: codeData.client_id, redirect_uri: codeData.redirect_uri, expiry: codeData.expiry })

  if (codeData.expiry < Date.now()) {
    await setPlatformConfig(`mcp_authcode_${code}`, "")
    return tokenError("invalid_grant", "Authorization code has expired")
  }

  // One-time use — consume now
  await setPlatformConfig(`mcp_authcode_${code}`, "")

  // client_id must match
  const effectiveClientId = authenticatedClientId ?? bodyClientId
  if (effectiveClientId && codeData.client_id && effectiveClientId !== codeData.client_id) {
    console.error("[mcp/token] client_id mismatch. got:", effectiveClientId, "expected:", codeData.client_id)
    return tokenError("invalid_grant", "client_id does not match the authorization request")
  }

  // redirect_uri must match if both provided
  if (redirectUri && codeData.redirect_uri && redirectUri !== codeData.redirect_uri) {
    console.error("[mcp/token] redirect_uri mismatch. got:", redirectUri, "expected:", codeData.redirect_uri)
    return tokenError("invalid_grant", "redirect_uri does not match the one used during authorization")
  }

  // PKCE verification
  if (codeData.code_challenge) {
    console.error("[mcp/token] verifying PKCE, code_verifier present:", !!codeVerifier)
    if (!codeVerifier) return tokenError("invalid_request", "Missing required parameter: code_verifier")
    if (!verifyPKCE(codeVerifier, codeData.code_challenge, codeData.code_challenge_method ?? "S256")) {
      return tokenError("invalid_grant", "PKCE code_verifier does not match code_challenge")
    }
  }

  const finalClientId = effectiveClientId || codeData.client_id
  const accessToken   = generateAccessToken(finalClientId, mcpKey)
  const refreshToken  = await generateRefreshToken(finalClientId)

  console.error("[mcp/token] authorization_code grant success for client:", finalClientId)

  return NextResponse.json(
    {
      access_token:  accessToken,
      token_type:    "Bearer",
      expires_in:    3600,
      refresh_token: refreshToken,
      scope:         "mcp",
    },
    { headers: CORS },
  )
}
