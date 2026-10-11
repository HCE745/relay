import { getPortalSession } from "@/lib/portal-session"
import { unauthorized, parseBody, runWrite } from "@/lib/api"
import { changeOrderDecisionSchema } from "@/lib/zod-schemas"
import { portalDecideChangeOrder } from "@/lib/data/change-orders"
type Ctx = { params: Promise<{ id: string }> }
// Customer self-service approval of a billable extra from the portal.
export async function POST(request: Request, { params }: Ctx) {
  const s = await getPortalSession()
  if (!s) return unauthorized()
  const { id } = await params
  const body = await parseBody(changeOrderDecisionSchema, request); if (!body.ok) return body.response
  return runWrite(() => portalDecideChangeOrder(s.organizationId, s.customerId, id, body.data.decision))
}
