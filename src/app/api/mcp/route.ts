import "server-only"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Access-Control-Max-Age":       "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "") }
  catch { return null }
}

// JSON-RPC helpers — always include CORS
function jsonOk(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: CORS })
}

function jsonErr(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { headers: CORS })
}

function textContent(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    isError,
  }
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_contacted_prospects",
    description: "Returns all companies in the Relay CRM prospect database with their contact status and domain. Use this before suggesting new prospects to avoid duplicates.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_prospect",
    description: "Creates a new prospect record in the Relay CRM database.",
    inputSchema: {
      type: "object",
      properties: {
        companyName: { type: "string", description: "Company name (required)" },
        website:     { type: "string", description: "Company website URL (e.g. https://acme.com)" },
        industry:    { type: "string", description: "Industry type (e.g. Manufacturing, Logistics)" },
        city:        { type: "string", description: "Headquarters city" },
        state:       { type: "string", description: "Headquarters state or province (2-letter code)" },
        summary:     { type: "string", description: "One-sentence description of the company" },
        fitScore:    { type: "number", description: "AI fit score 0–100 (higher = stronger prospect)" },
      },
      required: ["companyName", "website"],
    },
  },
  {
    name: "log_email_sent",
    description: "Records that an outreach email was sent to a prospect. Creates the email log entry in the CRM and marks the prospect as contacted.",
    inputSchema: {
      type: "object",
      properties: {
        prospectId: { type: "string", description: "Relay prospect ID — use this OR domain" },
        domain:     { type: "string", description: "Company domain (e.g. acme.com) — alternative to prospectId" },
        toEmail:    { type: "string", description: "Recipient email address" },
        subject:    { type: "string", description: "Email subject line (required)" },
        body:       { type: "string", description: "Email body text (required)" },
        sentAt:     { type: "string", description: "ISO 8601 timestamp (defaults to now)" },
      },
      required: ["domain", "subject", "body"],
    },
  },
  {
    name: "get_follow_up_queue",
    description: "Returns all prospects that have been contacted but have not replied and are due for a follow-up based on their last contact date.",
    inputSchema: {
      type: "object",
      properties: {
        minDaysWaiting: { type: "number", description: "Minimum days since last contact to include in queue (default: 3)" },
      },
      required: [],
    },
  },
  {
    name: "search_prospects",
    description: "Searches the Relay CRM prospect database by company name or website domain.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search string — matched against company name and website domain" },
      },
      required: ["query"],
    },
  },
]

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function getContactedProspects() {
  const prospects = await prisma.prospect.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:               true,
      companyName:      true,
      website:          true,
      industry:         true,
      currentCrmStatus: true,
      lastOutreachDate: true,
      lastReplyDate:    true,
      createdAt:        true,
    },
  })
  return prospects.map(p => ({
    id:              p.id,
    companyName:     p.companyName,
    website:         p.website ?? null,
    domain:          p.website ? extractDomain(p.website) : null,
    industry:        p.industry ?? null,
    status:          p.currentCrmStatus,
    lastContactDate: p.lastOutreachDate?.toISOString() ?? null,
    lastReplyDate:   p.lastReplyDate?.toISOString() ?? null,
    addedAt:         p.createdAt.toISOString(),
  }))
}

async function addProspect(args: Record<string, unknown>) {
  const companyName = String(args.companyName ?? "").trim()
  if (!companyName) throw new Error("companyName is required")

  const prospect = await prisma.prospect.create({
    data: {
      companyName,
      website:          args.website  ? String(args.website)  : null,
      industry:         args.industry ? String(args.industry) : null,
      headquartersCity:  args.city    ? String(args.city)     : null,
      headquartersState: args.state   ? String(args.state)    : null,
      researchSummary:   args.summary ? String(args.summary)  : null,
      aiFitScore:        args.fitScore ? Math.min(100, Math.max(0, Math.round(Number(args.fitScore)))) : null,
      source:            "ai_research",
    },
  })
  return { id: prospect.id, companyName: prospect.companyName, created: true }
}

async function logEmailSent(args: Record<string, unknown>) {
  const subject = String(args.subject ?? "").trim()
  const body    = String(args.body    ?? "").trim()
  if (!subject) throw new Error("subject is required")
  if (!body)    throw new Error("body is required")

  const sentAt = args.sentAt ? new Date(String(args.sentAt)) : new Date()

  let prospect: { id: string; companyName: string; website: string | null } | null = null
  if (args.prospectId) {
    prospect = await prisma.prospect.findUnique({
      where:  { id: String(args.prospectId) },
      select: { id: true, companyName: true, website: true },
    })
  } else if (args.domain) {
    const target = String(args.domain).toLowerCase().replace(/^www\./, "")
    const all = await prisma.prospect.findMany({ select: { id: true, companyName: true, website: true } })
    prospect = all.find(p => p.website && extractDomain(p.website) === target) ?? null
  }
  if (!prospect) throw new Error("Prospect not found — provide a valid prospectId or domain")

  const websiteDomain = prospect.website ? extractDomain(prospect.website) : null
  const toEmail = args.toEmail ? String(args.toEmail) : `contact@${websiteDomain ?? "unknown.com"}`

  const existingCall = await prisma.demoCall.findFirst({
    where: { companyName: { equals: prospect.companyName, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  const demoCallId = existingCall
    ? existingCall.id
    : (await prisma.demoCall.create({
        data: {
          contactName:    `${prospect.companyName} Outreach`,
          contactEmail:   toEmail,
          companyName:    prospect.companyName,
          leadSource:     "cold_outreach",
          callStatus:     "Pending",
          createdBySAName: "MCP",
        },
      })).id

  const bodyHtml = `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`

  const email = await prisma.crmEmail.create({
    data: {
      demoCallId,
      contactEmail: toEmail,
      direction:    "sent",
      fromAddress:  "will@getrelay.software",
      toAddress:    toEmail,
      subject,
      bodyHtml,
      bodyText:     body,
      sentAt,
      source:       "mcp",
    },
  })

  await prisma.prospect.update({
    where: { id: prospect.id },
    data:  { lastOutreachDate: sentAt, currentCrmStatus: "contacted" },
  })

  return { emailId: email.id, demoCallId, prospectId: prospect.id, toEmail }
}

async function getFollowUpQueue(args: Record<string, unknown>) {
  const minDays = typeof args.minDaysWaiting === "number" ? args.minDaysWaiting : 3
  const cutoff  = new Date(Date.now() - minDays * 86_400_000)

  const prospects = await prisma.prospect.findMany({
    where: {
      currentCrmStatus: "contacted",
      lastReplyDate:    null,
      lastOutreachDate: { not: null, lte: cutoff },
    },
    orderBy: { lastOutreachDate: "asc" },
    select: {
      id:               true,
      companyName:      true,
      website:          true,
      industry:         true,
      lastOutreachDate: true,
    },
  })

  const now = Date.now()
  return prospects.map(p => ({
    id:              p.id,
    companyName:     p.companyName,
    website:         p.website ?? null,
    domain:          p.website ? extractDomain(p.website) : null,
    industry:        p.industry ?? null,
    lastContactDate: p.lastOutreachDate?.toISOString() ?? null,
    daysWaiting:     p.lastOutreachDate
      ? Math.floor((now - p.lastOutreachDate.getTime()) / 86_400_000)
      : null,
  }))
}

async function searchProspects(args: Record<string, unknown>) {
  const query = String(args.query ?? "").trim()
  if (!query) return []

  const prospects = await prisma.prospect.findMany({
    where: {
      OR: [
        { companyName: { contains: query, mode: "insensitive" } },
        { website:     { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id:               true,
      companyName:      true,
      website:          true,
      industry:         true,
      currentCrmStatus: true,
      lastOutreachDate: true,
      lastReplyDate:    true,
    },
    take: 20,
  })

  return prospects.map(p => ({
    id:              p.id,
    companyName:     p.companyName,
    website:         p.website ?? null,
    domain:          p.website ? extractDomain(p.website) : null,
    industry:        p.industry ?? null,
    status:          p.currentCrmStatus,
    lastContactDate: p.lastOutreachDate?.toISOString() ?? null,
    lastReplyDate:   p.lastReplyDate?.toISOString() ?? null,
  }))
}

// ─── Tool Dispatcher ──────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_contacted_prospects": return textContent(await getContactedProspects())
    case "add_prospect":            return textContent(await addProspect(args))
    case "log_email_sent":          return textContent(await logEmailSent(args))
    case "get_follow_up_queue":     return textContent(await getFollowUpQueue(args))
    case "search_prospects":        return textContent(await searchProspects(args))
    default:                        return textContent(`Unknown tool: ${name}`, true)
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyOAuthToken(token: string, key: string, source: string): boolean {
  if (!token.startsWith("mcp.")) {
    console.error(`[mcp/auth] ${source}: not mcp.{} format — starts with: ${token.slice(0, 12)}`)
    return false
  }
  const rest    = token.slice(4)
  const lastDot = rest.lastIndexOf(".")
  if (lastDot === -1) {
    console.error(`[mcp/auth] ${source}: no payload.sig separator`)
    return false
  }
  const payload  = rest.slice(0, lastDot)
  const sig      = rest.slice(lastDot + 1)
  console.error(`[mcp/auth] ${source}: payload prefix: ${payload.slice(0, 20)}, sig prefix: ${sig.slice(0, 16)}`)

  const expected = crypto.createHmac("sha256", key).update(payload).digest("hex")
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      console.error(`[mcp/auth] ${source}: HMAC mismatch — expected prefix: ${expected.slice(0, 16)}`)
      return false
    }
  } catch (e) {
    console.error(`[mcp/auth] ${source}: timingSafeEqual error:`, e)
    return false
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number; cid?: string }
    console.error(`[mcp/auth] ${source}: claims:`, JSON.stringify(claims))
    if (typeof claims.exp === "number" && claims.exp < Date.now()) {
      console.error(`[mcp/auth] ${source}: token expired — exp: ${claims.exp}, now: ${Date.now()}`)
      return false
    }
  } catch (e) {
    console.error(`[mcp/auth] ${source}: payload decode error:`, e)
    return false
  }

  console.error(`[mcp/auth] ${source}: HMAC OK, token valid`)
  return true
}

// Extract a bearer token from a raw Authorization header string.
function extractBearer(header: string): string {
  return header.startsWith("Bearer ") ? header.slice(7).trim() : ""
}

// Vercel replaces the incoming Authorization header with an internal JWT and
// base64-encodes the original Authorization value in the 'forwarded' header's
// sig= field.  Try both offset 0 (full base64) and offset 1 (skip a leading
// version byte) since the field sometimes has a prefix byte before "Bearer ...".
function extractTokenFromForwarded(forwardedHeader: string): string {
  const m = forwardedHeader.match(/(?:^|[,;])\s*sig=([A-Za-z0-9+/=]+)/)
  if (!m) return ""
  const sigB64 = m[1]
  console.error("[mcp/auth] forwarded sig (truncated):", sigB64.slice(0, 100))

  for (const offset of [0, 1]) {
    try {
      const decoded = Buffer.from(sigB64.slice(offset), "base64").toString("utf8")
      console.error(`[mcp/auth] forwarded sig decoded (offset=${offset}):`, JSON.stringify(decoded.slice(0, 120)))
      if (decoded.startsWith("Bearer ")) return decoded.slice(7).trim()
    } catch { /* ignore */ }
  }
  return ""
}

function checkAuth(req: NextRequest): { error: NextResponse } | { ok: true } {
  const mcpKey = process.env.MCP_API_KEY
  if (!mcpKey) {
    console.error("[mcp/auth] MCP_API_KEY not set")
    return { error: NextResponse.json({ error: "MCP_API_KEY not configured" }, { status: 500, headers: CORS }) }
  }

  // ── IP + MCP protocol header bypass ───────────────────────────────────────
  // Vercel strips the Authorization header before it reaches this handler.
  // Claude.ai's MCP connector originates from 160.79.106.0/24 and sends
  // mcp-protocol-version on every request.  Both signals together are a
  // reliable indicator this is a legitimate Claude.ai MCP call.
  const realIp        = req.headers.get("x-real-ip") ?? ""
  const mcpProtoHdr   = req.headers.get("mcp-protocol-version") ?? ""
  console.error(`[mcp/auth] x-real-ip: ${realIp || "(absent)"} | mcp-protocol-version: ${mcpProtoHdr || "(absent)"}`)
  if (realIp.startsWith("160.79.106.") && mcpProtoHdr) {
    console.error("[mcp/auth] accepted: Claude.ai IP+header bypass (ip:", realIp, "proto:", mcpProtoHdr, ")")
    return { ok: true }
  }

  // ── Source 1: standard Authorization header ────────────────────────────────
  const standardAuth = req.headers.get("authorization") ?? ""
  console.error("[mcp/auth] Authorization header:", standardAuth || "(absent)")
  const standardToken = extractBearer(standardAuth)

  // ── Source 2: x-vercel-sc-headers ─────────────────────────────────────────
  const scRaw = req.headers.get("x-vercel-sc-headers")
  let scToken = ""
  if (scRaw) {
    console.error("[mcp/auth] x-vercel-sc-headers (truncated):", scRaw.slice(0, 500))
    try {
      const scHeaders = JSON.parse(scRaw) as Record<string, string>
      const scAuth = scHeaders["authorization"] ?? scHeaders["Authorization"] ?? ""
      if (scAuth) {
        console.error("[mcp/auth] x-vercel-sc-headers authorization:", scAuth.slice(0, 80))
        scToken = extractBearer(scAuth)
      }
    } catch {
      console.error("[mcp/auth] could not parse x-vercel-sc-headers as JSON")
    }
  }

  // ── Source 3: forwarded header sig= field ─────────────────────────────────
  const forwardedRaw = req.headers.get("forwarded") ?? ""
  let forwardedToken = ""
  if (forwardedRaw) {
    console.error("[mcp/auth] forwarded header (truncated):", forwardedRaw.slice(0, 300))
    forwardedToken = extractTokenFromForwarded(forwardedRaw)
    if (forwardedToken) console.error("[mcp/auth] forwarded token prefix:", forwardedToken.slice(0, 20))
  }

  // Try all sources in priority order.  If the standard Authorization header
  // is a Vercel-internal JWT (eyJ...) verifyOAuthToken logs the mismatch and
  // we fall through to the forwarded-sig recovery path.
  for (const [source, token] of [
    ["standard-header",     standardToken],
    ["x-vercel-sc-headers", scToken],
    ["forwarded-sig",       forwardedToken],
  ] as const) {
    if (!token) continue
    if (token === mcpKey) {
      console.error(`[mcp/auth] accepted: static key match from ${source}`)
      return { ok: true }
    }
    if (verifyOAuthToken(token, mcpKey, source)) return { ok: true }
  }

  console.error("[mcp/auth] all auth attempts failed")
  return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS }) }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET — discovery manifest (no auth required, Streamable HTTP transport uses POST only)
export async function GET(req: NextRequest) {
  console.error("[mcp/GET] Accept:", req.headers.get("accept"), "| Authorization:", req.headers.get("authorization") ? "(present)" : "(absent)")

  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost"
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const base  = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`
  const server = `${base}/api/mcp`

  return NextResponse.json({
    name:            "relay-crm",
    version:         "1.0.0",
    description:     "Relay CRM MCP Server — query and update the Relay prospect database",
    protocolVersion: "2025-03-26",
    capabilities:    { tools: {} },
    serverInfo:      { name: "relay-crm", version: "1.0.0" },
    auth: {
      type:              "oauth2",
      authorization_url: `${server}/oauth/authorize`,
      token_url:         `${server}/oauth/token`,
      metadata_url:      `${server}/.well-known/oauth-authorization-server`,
    },
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
  }, { headers: CORS })
}

// POST — MCP JSON-RPC 2.0, Streamable HTTP transport (2025-03-26)
export async function POST(req: NextRequest) {
  console.error("[mcp/POST] --- incoming request ---")
  console.error("[mcp/POST] headers:", JSON.stringify(Object.fromEntries(req.headers)))

  const auth = checkAuth(req)
  if ("error" in auth) {
    console.error("[mcp/POST] auth rejected")
    return auth.error
  }

  let rawBody: string
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown }
  try {
    rawBody = await req.text()
    console.error("[mcp/POST] raw body:", rawBody)
    body = JSON.parse(rawBody) as typeof body
  } catch {
    console.error("[mcp/POST] JSON parse error")
    return jsonErr(null, -32700, "Parse error: invalid JSON")
  }

  const { method, params } = body
  const id = "id" in body ? body.id : undefined

  // Notifications (no id field) — must return 202 Accepted with no body
  if (!("id" in body)) {
    console.error("[mcp/POST] notification method:", method, "→ 202")
    return new NextResponse(null, { status: 202, headers: CORS })
  }

  if (!method) {
    console.error("[mcp/POST] missing method field in body")
    return jsonErr(id, -32600, "Invalid request: missing method")
  }

  console.error("[mcp/POST] >>> method:", method, "| id:", id)

  switch (method) {
    case "initialize": {
      const result = {
        protocolVersion: "2025-03-26",
        capabilities:    { tools: {} },
        serverInfo:      { name: "relay-crm", version: "1.0.0" },
      }
      console.error("[mcp/POST] <<< initialize:", JSON.stringify(result))
      return jsonOk(id, result)
    }

    case "tools/list": {
      const toolNames = TOOLS.map(t => t.name)
      console.error("[mcp/POST] <<< tools/list:", TOOLS.length, "tools:", toolNames.join(", "))
      console.error("[mcp/POST] tools/list full response:", JSON.stringify({ tools: TOOLS }))
      return jsonOk(id, { tools: TOOLS })
    }

    case "tools/call": {
      const p = params as { name?: string; arguments?: Record<string, unknown> }
      if (!p?.name) return jsonErr(id, -32602, "Invalid params: missing tool name")
      console.error("[mcp/POST] >>> tools/call:", p.name, "args:", JSON.stringify(p.arguments ?? {}))
      try {
        const result = await callTool(p.name, p.arguments ?? {})
        console.error("[mcp/POST] <<< tools/call:", p.name, "isError:", result.isError)
        return jsonOk(id, result)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[mcp/POST] <<< tools/call error:", p.name, msg)
        return jsonOk(id, textContent(`Error executing ${p.name}: ${msg}`, true))
      }
    }

    case "ping":
      console.error("[mcp/POST] <<< ping")
      return jsonOk(id, {})

    default:
      console.error("[mcp/POST] <<< unknown method:", method, "→ -32601")
      return jsonErr(id, -32601, `Method not found: ${method}`)
  }
}
