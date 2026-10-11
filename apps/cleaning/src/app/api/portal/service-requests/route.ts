import { getPortalSession } from "@/lib/portal-session"
import { unauthorized, parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { createServiceRequest } from "@/lib/data/service-requests"
export async function POST(request: Request) {
  const s = await getPortalSession(); if (!s) return unauthorized()
  const body = await parseBody(z.object({ jobId: z.string().min(1), type: z.enum(["RESCHEDULE", "CANCEL"]), requestedDate: z.string().optional(), requestedTime: z.string().optional(), note: z.string().max(1000).optional() }), request)
  if (!body.ok) return body.response
  return runWrite(() => createServiceRequest(s.organizationId, s.customerId, body.data), { created: true })
}
