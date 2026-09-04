import { createHmac } from "crypto"
import { prisma } from "@/lib/prisma"

export type WebhookEvent =
  | "issue_created"
  | "issue_resolved"
  | "issue_escalated"
  | "injury_reported"
  | "purchase_approved"
  | "suggestion_created"

export async function dispatchWebhook(
  organizationId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      organizationId,
      isActive: true,
      events: { has: event },
    },
  })

  if (endpoints.length === 0) return

  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({ event, timestamp, data: payload })

  await Promise.allSettled(endpoints.map(async (ep) => {
    const signature = createHmac("sha256", ep.secret)
      .update(`${timestamp}.${body}`)
      .digest("hex")

    let responseStatus: number | null = null
    let responseBody: string | null = null
    let success = false

    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-relay-signature": `sha256=${signature}`,
          "x-relay-timestamp": String(timestamp),
          "x-relay-event": event,
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
      responseStatus = res.status
      responseBody = (await res.text()).slice(0, 500)
      success = res.ok
    } catch (err) {
      responseBody = String(err).slice(0, 500)
    }

    await prisma.webhookDeliveryLog.create({
      data: {
        endpointId: ep.id,
        event,
        payload: JSON.parse(body),
        responseStatus,
        responseBody,
        success,
      },
    })
  }))
}
