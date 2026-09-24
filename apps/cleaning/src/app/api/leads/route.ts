import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { leadCreateSchema } from "@/lib/zod-schemas"
import { createLead, listLeads } from "@/lib/data/leads"

const CAP = "crm.estimates"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listLeads(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(leadCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createLead(g.orgId, body.data), { created: true })
}
