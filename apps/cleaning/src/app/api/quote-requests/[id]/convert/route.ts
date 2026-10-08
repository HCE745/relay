import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { convertQuoteRequest } from "@/lib/data/quote-requests"
import { z } from "zod"

const CAP = "crm.quoting"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(z.object({ toLead: z.boolean().optional(), toEstimate: z.boolean().optional() }), request)
  if (!body.ok) return body.response
  return runWrite(() => convertQuoteRequest(g.orgId, id, body.data))
}
