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

// Fallback — Claude.ai may call /api/register if it strips the /api/mcp prefix.
// Proxy (not redirect) so the POST method and body are preserved unconditionally.
export async function POST(req: NextRequest) {
  const host  = req.headers.get("host") ?? "localhost"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const base  = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`
  const target = `${base}/api/mcp/oauth/register`

  const body = await req.text()
  console.error("[api/register] proxying POST to:", target)
  console.error("[api/register] content-type:", req.headers.get("content-type"))
  console.error("[api/register] body:", body)

  const upstream = await fetch(target, {
    method:  "POST",
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body,
  })

  const responseText = await upstream.text()
  console.error("[api/register] upstream status:", upstream.status, "body:", responseText)

  return new NextResponse(responseText, {
    status:  upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      ...CORS,
    },
  })
}
