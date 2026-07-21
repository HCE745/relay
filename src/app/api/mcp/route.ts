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

// MCP HTTP+SSE transport: wrap a JSON-RPC object in an SSE "message" event.
// Used when the client sends Accept: text/event-stream.
function sseOk(id: unknown, result: unknown): Response {
  const payload = JSON.stringify({ jsonrpc: "2.0", id, result })
  return new Response(`event: message\ndata: ${payload}\n\n`, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
  })
}

function sseErr(id: unknown, code: number, message: string): Response {
  const payload = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })
  return new Response(`event: message\ndata: ${payload}\n\n`, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
  })
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
      required: ["companyName"],
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
      required: ["subject", "body"],
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

function verifyOAuthToken(token: string, key: string): boolean {
  if (!token.startsWith("mcp.")) return false
  const rest    = token.slice(4)
  const lastDot = rest.lastIndexOf(".")
  if (lastDot === -1) return false
  const payload  = rest.slice(0, lastDot)
  const sig      = rest.slice(lastDot + 1)
  const expected = crypto.createHmac("sha256", key).update(payload).digest("hex")
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return false
  } catch { return false }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number }
    if (typeof claims.exp === "number" && claims.exp < Date.now()) return false
  } catch { return false }
  return true
}

function checkAuth(req: NextRequest): { error: NextResponse } | { ok: true } {
  const mcpKey = process.env.MCP_API_KEY
  if (!mcpKey) {
    return { error: NextResponse.json({ error: "MCP_API_KEY not configured" }, { status: 500, headers: CORS }) }
  }
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  console.error("[mcp] auth header present:", !!auth, "| token prefix:", token.slice(0, 8) || "(none)")
  if (token === mcpKey) return { ok: true }
  if (token && verifyOAuthToken(token, mcpKey)) return { ok: true }
  return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS }) }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET — server manifest + SSE stream for MCP HTTP+SSE transport
export async function GET(req: NextRequest) {
  const accept = req.headers.get("accept") ?? ""
  console.error("[mcp/GET] Accept:", accept, "| Authorization:", req.headers.get("authorization") ? "(present)" : "(absent)")

  // MCP HTTP+SSE transport: client GETs to open a server-sent-events stream.
  // Respond with a minimal SSE stream that sends one endpoint event and stays
  // open so Claude.ai considers the connection established.
  if (accept.includes("text/event-stream")) {
    const auth = checkAuth(req)
    if ("error" in auth) {
      console.error("[mcp/GET SSE] auth failed")
      return auth.error
    }

    console.error("[mcp/GET SSE] opening SSE stream")
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // Send the endpoint URL so the client knows where to POST messages
        controller.enqueue(encoder.encode(`event: endpoint\ndata: /api/mcp\n\n`))

        // Keep alive with comment pings every 25 s (within Vercel's 30 s idle timeout)
        const timer = setInterval(() => {
          try { controller.enqueue(encoder.encode(`: ping\n\n`)) }
          catch { clearInterval(timer) }
        }, 25_000)

        req.signal.addEventListener("abort", () => {
          clearInterval(timer)
          try { controller.close() } catch { /* already closed */ }
        })
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection":    "keep-alive",
        "X-Accel-Buffering": "no",
        ...CORS,
      },
    })
  }

  // Plain GET — discovery manifest (no auth required)
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost"
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const base  = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`
  const server = `${base}/api/mcp`

  return NextResponse.json({
    name:            "relay-crm",
    version:         "1.0.0",
    description:     "Relay CRM MCP Server — query and update the Relay prospect database",
    protocolVersion: "2024-11-05",
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

// POST — MCP JSON-RPC 2.0 over HTTP (also supports SSE-wrapped responses)
export async function POST(req: NextRequest) {
  console.error("[mcp/POST] --- incoming request ---")
  console.error("[mcp/POST] headers:", JSON.stringify(Object.fromEntries(req.headers)))

  const auth = checkAuth(req)
  if ("error" in auth) {
    console.error("[mcp/POST] auth rejected")
    return auth.error
  }

  // Whether the client wants SSE-wrapped responses (MCP HTTP+SSE transport)
  const wantsSSE = (req.headers.get("accept") ?? "").includes("text/event-stream")
  console.error("[mcp/POST] wantsSSE:", wantsSSE)

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown }
  try {
    body = await req.json() as typeof body
    console.error("[mcp/POST] method:", body.method, "| id:", body.id)
  } catch {
    console.error("[mcp/POST] JSON parse error")
    return wantsSSE
      ? sseErr(null, -32700, "Parse error: invalid JSON")
      : jsonErr(null, -32700, "Parse error: invalid JSON")
  }

  const { method, params } = body
  const id = "id" in body ? body.id : undefined

  // Notifications have no id — acknowledge and return
  if (!("id" in body)) {
    console.error("[mcp/POST] notification (no id):", method)
    return new NextResponse(null, { status: 204, headers: CORS })
  }

  if (!method) {
    return wantsSSE
      ? sseErr(id, -32600, "Invalid request: missing method")
      : jsonErr(id, -32600, "Invalid request: missing method")
  }

  const ok  = (result: unknown) => wantsSSE ? sseOk(id, result)  : jsonOk(id, result)
  const err = (code: number, msg: string) => wantsSSE ? sseErr(id, code, msg) : jsonErr(id, code, msg)

  console.error("[mcp/POST] handling method:", method)

  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: "2024-11-05",
        capabilities:    { tools: {} },
        serverInfo:      { name: "relay-crm", version: "1.0.0" },
      })

    case "tools/list":
      return ok({ tools: TOOLS })

    case "tools/call": {
      const p = params as { name?: string; arguments?: Record<string, unknown> }
      if (!p?.name) return err(-32602, "Invalid params: missing tool name")
      try {
        const result = await callTool(p.name, p.arguments ?? {})
        console.error("[mcp/POST] tool result for:", p.name, "isError:", result.isError)
        return ok(result)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[mcp/POST] tool error:", p.name, msg)
        return ok(textContent(`Error executing ${p.name}: ${msg}`, true))
      }
    }

    case "ping":
      return ok({})

    default:
      console.error("[mcp/POST] unknown method:", method)
      return err(-32601, `Method not found: ${method}`)
  }
}
