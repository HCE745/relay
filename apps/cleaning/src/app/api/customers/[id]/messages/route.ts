import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { listCustomerMessages, postStaffMessage, markThreadRead } from "@/lib/data/messages"
const CAP = "core.customers"
type Ctx = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  await markThreadRead(g.orgId, id, "staff")
  return ok(await listCustomerMessages(g.orgId, id))
}
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(z.object({ body: z.string().trim().min(1).max(4000) }), request); if (!body.ok) return body.response
  return runWrite(() => postStaffMessage(g.orgId, id, g.session.userId, body.data.body), { created: true })
}
