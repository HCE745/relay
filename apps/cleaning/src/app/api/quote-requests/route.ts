import { requireAccountManager } from "@/lib/guards"
import { parseBody, parseQuery, runWrite, ok } from "@/lib/api"
import { quoteRequestCreateSchema } from "@/lib/zod-schemas"
import { listQuoteRequests, createQuoteRequest } from "@/lib/data/quote-requests"
import { z } from "zod"

const CAP = "crm.quoting"

export async function GET(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const q = parseQuery(z.object({ status: z.string().optional() }), request.url)
  if (!q.ok) return q.response
  return ok(await listQuoteRequests(g.orgId, { status: q.data.status }))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(quoteRequestCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createQuoteRequest(g.orgId, body.data, g.session.userId), { created: true })
}
