import "server-only"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Fallback registration endpoint — Claude.ai may call /register or /api/register
// if it strips the /api/mcp prefix from the discovered registration_endpoint.
// 307 preserves the HTTP method (POST) and body so the registration data passes through.
export async function POST(req: NextRequest) {
  const host  = req.headers.get("host") ?? "localhost"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const base  = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`
  const target = `${base}/api/mcp/oauth/register`

  console.error("[api/register] redirecting POST to:", target)

  return NextResponse.redirect(target, { status: 307 })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
