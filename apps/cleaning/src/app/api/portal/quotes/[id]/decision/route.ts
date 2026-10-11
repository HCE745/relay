import { getPortalSession } from "@/lib/portal-session"
import { unauthorized, parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { portalDecideQuote } from "@/lib/data/portal-quotes"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const s = await getPortalSession(); if (!s) return unauthorized()
  const { id } = await params
  const body = await parseBody(z.object({ decision: z.enum(["APPROVED", "DECLINED"]) }), request); if (!body.ok) return body.response
  return runWrite(() => portalDecideQuote(s.organizationId, s.customerId, id, body.data.decision))
}
