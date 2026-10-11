import { getPortalSession } from "@/lib/portal-session"
import { unauthorized, ok, parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { listCustomerMessages, portalPostMessage, markThreadRead } from "@/lib/data/messages"
export async function GET() {
  const s = await getPortalSession(); if (!s) return unauthorized()
  await markThreadRead(s.organizationId, s.customerId, "customer")
  return ok(await listCustomerMessages(s.organizationId, s.customerId))
}
export async function POST(request: Request) {
  const s = await getPortalSession(); if (!s) return unauthorized()
  const body = await parseBody(z.object({ body: z.string().trim().min(1).max(4000) }), request); if (!body.ok) return body.response
  return runWrite(() => portalPostMessage(s.organizationId, s.customerId, s.userId, body.data.body), { created: true })
}
