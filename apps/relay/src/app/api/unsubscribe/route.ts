// Public one-click unsubscribe endpoint (CAN-SPAM compliant)
// Linked via List-Unsubscribe header in all outgoing CRM emails
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")?.toLowerCase()
  const token = searchParams.get("token")

  if (!email || !token) {
    return new NextResponse("Invalid unsubscribe link", { status: 400 })
  }

  // Verify token: base64url of the email address
  let expectedToken: string
  try {
    expectedToken = Buffer.from(email).toString("base64url")
  } catch {
    return new NextResponse("Invalid unsubscribe link", { status: 400 })
  }

  if (token !== expectedToken) {
    return new NextResponse("Invalid unsubscribe link", { status: 400 })
  }

  await prisma.unsubscribeRecord.upsert({
    where:  { email },
    create: { id: `unsub_${Date.now()}`, email, reason: "UNSUBSCRIBE" },
    update: { reason: "UNSUBSCRIBE" },
  })

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;text-align:center;color:#333}
h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#666;line-height:1.6}</style></head>
<body><h1>You've been unsubscribed</h1>
<p>${email} has been removed from Relay's sales email list. You won't receive any further outreach from us.</p>
<p style="margin-top:2rem;font-size:.85rem;color:#999">If you believe this was a mistake, please reply to any email you received from us.</p>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  )
}

// One-click unsubscribe via POST (RFC 8058 / Gmail one-click)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")?.toLowerCase()
  const token = searchParams.get("token")

  if (!email || !token) return NextResponse.json({ ok: false }, { status: 400 })

  let expectedToken: string
  try {
    expectedToken = Buffer.from(email).toString("base64url")
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (token !== expectedToken) return NextResponse.json({ ok: false }, { status: 400 })

  await prisma.unsubscribeRecord.upsert({
    where:  { email },
    create: { id: `unsub_${Date.now()}`, email, reason: "UNSUBSCRIBE" },
    update: { reason: "UNSUBSCRIBE" },
  })

  return NextResponse.json({ ok: true })
}
