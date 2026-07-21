import "server-only"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getPlatformConfig, setPlatformConfig } from "@/lib/platform-config"

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

// Resolve and validate redirect_uri for a given client_id.
// Returns the URI to use, or an error string.
async function resolveRedirectUri(
  clientId: string,
  requested: string,
): Promise<{ uri: string } | { error: string }> {
  if (!clientId) {
    // No registered client — use whatever was passed
    return requested ? { uri: requested } : { error: "redirect_uri is required" }
  }

  const raw = await getPlatformConfig(`mcp_client_${clientId}`)
  if (!raw) {
    console.error("[mcp/authorize] unknown client_id:", clientId)
    return { error: `Unknown client_id: ${clientId}` }
  }

  let client: ClientRecord
  try { client = JSON.parse(raw) as ClientRecord }
  catch { return { error: "Malformed client record" } }

  const registered = client.redirect_uris ?? []

  if (registered.length === 0) {
    // No registered URIs — accept any (allow PKCE-only flow)
    return requested ? { uri: requested } : { error: "redirect_uri is required" }
  }

  if (!requested) {
    // Use first registered URI when caller omits it
    return { uri: registered[0] }
  }

  if (!registered.includes(requested)) {
    console.error("[mcp/authorize] redirect_uri mismatch. got:", requested, "registered:", registered)
    return { error: `redirect_uri not registered. Registered: ${registered.join(", ")}` }
  }

  return { uri: requested }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function loginPage(p: {
  client_id:             string
  redirect_uri:          string
  state:                 string
  code_challenge:        string
  code_challenge_method: string
  error?: string
}): string {
  const errorHtml = p.error
    ? `<div class="error">${escapeHtml(p.error)}</div>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Relay CRM — Authorize Claude.ai</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b1120;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:40px;width:100%;max-width:400px;box-shadow:0 25px 50px rgba(0,0,0,.5)}
.logo{display:flex;align-items:center;gap:10px;margin-bottom:32px;justify-content:center}
.logo-name{color:#fff;font-size:20px;font-weight:700}
.logo-badge{background:#dc2626;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:1px;text-transform:uppercase}
h1{color:#fff;font-size:22px;font-weight:600;margin-bottom:8px;text-align:center}
p.sub{color:#9ca3af;font-size:14px;text-align:center;margin-bottom:28px;line-height:1.5}
.error{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px}
label{display:block;color:#d1d5db;font-size:13px;font-weight:500;margin-bottom:6px}
input[type=password]{width:100%;background:#1f2937;border:1px solid #374151;border-radius:8px;color:#fff;font-size:15px;padding:11px 14px;outline:none;transition:border-color .15s}
input[type=password]:focus{border-color:#4f46e5}
button{width:100%;background:#4f46e5;color:#fff;font-size:15px;font-weight:600;padding:12px;border:none;border-radius:8px;cursor:pointer;margin-top:20px;transition:background .15s}
button:hover{background:#4338ca}
.hint{color:#6b7280;font-size:12px;text-align:center;margin-top:16px;line-height:1.4}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <span class="logo-name">Relay</span>
    <span class="logo-badge">CRM</span>
  </div>
  <h1>Connect Claude.ai</h1>
  <p class="sub">Enter your MCP API key to grant Claude.ai read and write access to the Relay CRM.</p>
  ${errorHtml}
  <form method="POST">
    <input type="hidden" name="client_id"             value="${escapeHtml(p.client_id)}" />
    <input type="hidden" name="redirect_uri"          value="${escapeHtml(p.redirect_uri)}" />
    <input type="hidden" name="state"                 value="${escapeHtml(p.state)}" />
    <input type="hidden" name="code_challenge"        value="${escapeHtml(p.code_challenge)}" />
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(p.code_challenge_method)}" />
    <label for="api_key">MCP API Key</label>
    <input type="password" id="api_key" name="api_key" placeholder="Your MCP_API_KEY value" autofocus autocomplete="current-password" />
    <button type="submit">Authorize Access</button>
  </form>
  <p class="hint">Your MCP_API_KEY is set in Vercel environment variables.<br/>See MCP_SETUP.md for details.</p>
</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const url                   = new URL(req.url)
  const client_id             = url.searchParams.get("client_id")             ?? ""
  const requested_redirect    = url.searchParams.get("redirect_uri")          ?? ""
  const state                 = url.searchParams.get("state")                 ?? ""
  const code_challenge        = url.searchParams.get("code_challenge")        ?? ""
  const code_challenge_method = url.searchParams.get("code_challenge_method") ?? "S256"
  const response_type         = url.searchParams.get("response_type")         ?? ""

  console.error("[mcp/authorize GET] params:", {
    client_id, redirect_uri: requested_redirect, state,
    code_challenge: code_challenge ? "(present)" : "(absent)",
    code_challenge_method, response_type,
  })

  if (response_type && response_type !== "code") {
    return new NextResponse(`Unsupported response_type: ${response_type}`, { status: 400 })
  }

  const resolved = await resolveRedirectUri(client_id, requested_redirect)
  if ("error" in resolved) {
    return new NextResponse(resolved.error, { status: 400 })
  }

  console.error("[mcp/authorize GET] resolved redirect_uri:", resolved.uri)

  const html = loginPage({
    client_id,
    redirect_uri:          resolved.uri,
    state,
    code_challenge,
    code_challenge_method,
  })
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}

export async function POST(req: NextRequest) {
  const form                  = await req.formData()
  const apiKey               = (form.get("api_key")               as string) ?? ""
  const client_id            = (form.get("client_id")             as string) ?? ""
  const form_redirect_uri    = (form.get("redirect_uri")          as string) ?? ""
  const state                = (form.get("state")                 as string) ?? ""
  const code_challenge       = (form.get("code_challenge")        as string) ?? ""
  const code_challenge_method = (form.get("code_challenge_method") as string) ?? "S256"

  console.error("[mcp/authorize POST] client_id:", client_id, "redirect_uri:", form_redirect_uri)

  const mcpKey = process.env.MCP_API_KEY
  if (!mcpKey) {
    return new NextResponse("MCP_API_KEY is not configured on the server", { status: 500 })
  }

  // Re-validate redirect_uri against registered client (prevents form tampering)
  const resolved = await resolveRedirectUri(client_id, form_redirect_uri)
  if ("error" in resolved) {
    console.error("[mcp/authorize POST] redirect_uri error:", resolved.error)
    return new NextResponse(resolved.error, { status: 400 })
  }
  const redirect_uri = resolved.uri

  if (apiKey !== mcpKey) {
    console.error("[mcp/authorize POST] wrong api key")
    const html = loginPage({
      client_id, redirect_uri, state, code_challenge, code_challenge_method,
      error: "Invalid API key. Check your MCP_API_KEY value and try again.",
    })
    return new NextResponse(html, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  // Issue short-lived authorization code (5 minutes)
  const authCode = crypto.randomBytes(32).toString("base64url")
  const codeData: AuthCodeData = {
    redirect_uri,
    client_id,
    code_challenge,
    code_challenge_method,
    expiry: Date.now() + 5 * 60 * 1000,
  }
  await setPlatformConfig(`mcp_authcode_${authCode}`, JSON.stringify(codeData))

  console.error("[mcp/authorize POST] issued auth code, redirecting to:", redirect_uri)

  const dest = new URL(redirect_uri)
  dest.searchParams.set("code", authCode)
  if (state) dest.searchParams.set("state", state)

  return NextResponse.redirect(dest.toString())
}
