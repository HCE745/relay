import { getPortalSession } from "@/lib/portal-session"
import { unauthorized, parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { submitSurvey } from "@/lib/data/surveys"
export async function POST(request: Request) {
  const s = await getPortalSession(); if (!s) return unauthorized()
  const body = await parseBody(z.object({ jobId: z.string().min(1), rating: z.coerce.number().int().min(1).max(5), comment: z.string().max(1000).optional() }), request)
  if (!body.ok) return body.response
  return runWrite(() => submitSurvey(s.organizationId, s.customerId, body.data.jobId, body.data.rating, body.data.comment), { created: true })
}
