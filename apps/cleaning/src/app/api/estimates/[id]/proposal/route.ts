import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { createProposal } from "@/lib/data/proposals"
const CAP = "crm.estimates"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(z.object({ terms: z.string().max(5000).optional() }), request); if (!body.ok) return body.response
  return runWrite(() => createProposal(g.orgId, id, body.data.terms, g.session.userId), { created: true })
}
