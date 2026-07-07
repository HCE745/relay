import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

const VALID_EVENTS = [
  "issue_created", "issue_resolved", "issue_escalated",
  "injury_reported", "purchase_approved", "suggestion_created",
]

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { deliveryLogs: true } },
    },
  })

  return NextResponse.json({ endpoints: endpoints.map(e => ({
    id: e.id, name: e.name, url: e.url,
    events: e.events, isActive: e.isActive,
    deliveryCount: e._count.deliveryLogs,
    createdAt: e.createdAt,
  })) })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { api_webhooks_enabled: true },
  })
  if (!org?.api_webhooks_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 })
  }

  const body = await req.json() as { name: string; url: string; events: string[] }

  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
  if (!body.url?.startsWith("https://")) return NextResponse.json({ error: "URL must be HTTPS" }, { status: 400 })
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: "Select at least one event" }, { status: 400 })
  }
  const invalidEvents = body.events.filter(e => !VALID_EVENTS.includes(e))
  if (invalidEvents.length > 0) {
    return NextResponse.json({ error: `Invalid events: ${invalidEvents.join(", ")}` }, { status: 400 })
  }

  const secret = `whsec_${randomBytes(32).toString("hex")}`

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      organizationId: session.organizationId,
      name: body.name.trim(),
      url: body.url.trim(),
      secret,
      events: body.events,
    },
  })

  return NextResponse.json({
    endpoint: { id: endpoint.id, name: endpoint.name, url: endpoint.url, events: endpoint.events, isActive: endpoint.isActive },
    secret,
  })
}
