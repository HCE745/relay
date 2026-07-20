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
  const host  = req.headers.get("host") ?? "localhost"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const base  = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`
  const server = `${base}/api/mcp`

  const metadata = {
    resource:                 server,
    authorization_servers:    [server],
    bearer_methods_supported: ["header"],
  }

  console.error("[mcp/oauth-protected-resource] NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
  console.error("[mcp/oauth-protected-resource] resolved server:", server)
  console.error("[mcp/oauth-protected-resource] returning:", JSON.stringify(metadata))

  return NextResponse.json(metadata, { headers: CORS })
}
