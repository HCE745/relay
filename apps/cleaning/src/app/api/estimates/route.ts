import { z } from "zod"
import { requireAccountManager } from "@/lib/guards"
import { parseBody, parseQuery, runWrite, ok } from "@/lib/api"
import { estimateCreateSchema } from "@/lib/zod-schemas"
import { createEstimate, listEstimates } from "@/lib/data/estimates"

const CAP = "crm.estimates"
const listQuery = z.object({ status: z.string().optional() })

export async function GET(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const q = parseQuery(listQuery, request.url)
  if (!q.ok) return q.response
  return ok(await listEstimates(g.orgId, q.data))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(estimateCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createEstimate(g.orgId, body.data), { created: true })
}
