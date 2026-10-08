import { requireAccountManager } from "@/lib/guards"
import { parseBody, parseQuery, runWrite, ok } from "@/lib/api"
import { applicantCreateSchema } from "@/lib/zod-schemas"
import { listApplicants, createApplicant } from "@/lib/data/hiring"
import { z } from "zod"
const CAP = "workforce.hiring"
export async function GET(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const q = parseQuery(z.object({ status: z.string().optional(), jobPostingId: z.string().optional() }), request.url); if (!q.ok) return q.response
  return ok(await listApplicants(g.orgId, q.data))
}
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(applicantCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createApplicant(g.orgId, body.data), { created: true })
}
