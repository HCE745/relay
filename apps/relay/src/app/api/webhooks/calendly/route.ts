import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { setLifecycle } from "@/lib/crm-lifecycle"
import crypto from "crypto"

// Calendly signs webhooks with: Calendly-Webhook-Signature: t=TIMESTAMP,v1=HMAC_SHA256
// HMAC is computed over "${timestamp}.${rawBody}" using the webhook signing secret.
function verifyCalendlySignature(rawBody: string, header: string, secret: string): boolean {
  const parts    = header.split(",")
  const tPart    = parts.find(p => p.startsWith("t="))
  const v1Part   = parts.find(p => p.startsWith("v1="))
  if (!tPart || !v1Part) return false

  const timestamp    = tPart.slice(2)
  const receivedHex  = v1Part.slice(3)
  const signedInput  = `${timestamp}.${rawBody}`
  const expectedHex  = crypto.createHmac("sha256", secret).update(signedInput).digest("hex")

  // Reject if timestamp is more than 5 minutes old
  const ts = parseInt(timestamp, 10)
  if (!isNaN(ts) && Math.abs(Date.now() / 1000 - ts) > 300) return false

  try {
    return crypto.timingSafeEqual(Buffer.from(receivedHex, "hex"), Buffer.from(expectedHex, "hex"))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })

  const rawBody   = await req.text()
  const sigHeader = req.headers.get("calendly-webhook-signature") ?? ""

  if (!sigHeader || !verifyCalendlySignature(rawBody, sigHeader, secret)) {
    return NextResponse.json({ error: "Invalid or missing signature" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event   = body.event as string
  // Calendly v2 webhook: fields are directly on payload, not nested in an "invitee" sub-object
  const payload = (body.payload as Record<string, unknown>) ?? {}

  const email        = (payload.email as string | undefined) ?? ""
  const name         = (payload.name  as string | undefined) ?? ""
  const inviteeUri   = (payload.uri   as string | undefined) ?? ""  // unique per invitee
  const scheduledEvt = (payload.scheduled_event as Record<string, unknown> | undefined) ?? {}
  const eventName    = (scheduledEvt.name as string | undefined) ?? "Demo Call"
  const startTime    = scheduledEvt.start_time
    ? new Date(scheduledEvt.start_time as string)
    : null

  if (event === "invitee.created") {
    // Try to find an existing org by admin user email
    const adminUser = await prisma.user.findFirst({
      where:   { email, role: "ADMIN" },
      include: { organization: true },
    })
    const org = adminUser?.organization ?? null

    const call = await prisma.demoCall.create({
      data: {
        contactName:     name || email,
        contactEmail:    email,
        companyName:     org?.name ?? "Unknown",
        leadSource:      "Calendly",
        scheduledAt:     startTime,
        callStatus:      "Scheduled",
        calendlyEventId: inviteeUri,   // invitee URI — unique, used for cancellation lookup
        calendlyPayload: JSON.stringify(body),
        organizationId:  org?.id ?? null,
        createdBySAName: "Calendly",
      },
    })

    if (org) {
      await prisma.crmActivity.create({
        data: {
          organizationId:  org.id,
          eventType:       "demo_scheduled",
          description:     `Demo booked via Calendly: "${eventName}" on ${startTime?.toLocaleDateString() ?? "TBD"}`,
          createdBySAName: "Calendly",
        },
      })
      const currentOrg = await prisma.organization.findUnique({
        where:  { id: org.id },
        select: { lifecycleStatus: true },
      })
      if (currentOrg && currentOrg.lifecycleStatus === "Lead") {
        await setLifecycle(org.id, "Demo Scheduled", "Calendly", currentOrg.lifecycleStatus)
      }
    }

    return NextResponse.json({ ok: true, callId: call.id })
  }

  if (event === "invitee.canceled") {
    // Primary lookup: by stored invitee URI
    let call = await prisma.demoCall.findFirst({
      where: { calendlyEventId: inviteeUri },
    })

    // Fallback: match by email + approximate time (for records created before URI-based storage)
    if (!call && email && startTime) {
      const windowStart = new Date(startTime.getTime() - 2 * 60 * 60 * 1000)
      const windowEnd   = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)
      call = await prisma.demoCall.findFirst({
        where: {
          contactEmail: email,
          scheduledAt:  { gte: windowStart, lte: windowEnd },
          callStatus:   { not: "Cancelled" },
        },
        orderBy: { createdAt: "desc" },
      })
    }

    if (call) {
      await prisma.demoCall.update({
        where: { id: call.id },
        data:  { callStatus: "Cancelled" },
      })
      if (call.organizationId) {
        await prisma.crmActivity.create({
          data: {
            organizationId:  call.organizationId,
            eventType:       "demo_cancelled",
            description:     `Demo call cancelled via Calendly`,
            createdBySAName: "Calendly",
          },
        })
      }
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true, event: "unhandled" })
}
