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
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost"
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  const base   = resolveBase(req)
  const server = `${base}/api/mcp`

  const metadata = {
    resource:                 server,
    authorization_servers:    [server],
    bearer_methods_supported: ["header"],
  }

  console.error("[mcp/oauth-protected-resource] resolved base:", base)
  console.error("[mcp/oauth-protected-resource] returning:", JSON.stringify(metadata))

  return NextResponse.json(metadata, { headers: CORS })
}
