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

  return NextResponse.json(
    {
      resource:                 server,
      authorization_servers:    [server],
      bearer_methods_supported: ["header"],
    },
    { headers: CORS },
  )
}
