import { getPortalSession } from "@/lib/portal-session"
import { parseBody, runWrite, unauthorized } from "@/lib/api"
import { portalIssueSchema } from "@/lib/zod-schemas"
import { reportPortalIssue } from "@/lib/data/portal"

// Portal users report issues against their OWN sites only (enforced in the data
// layer). Self-guards on the portal session — never the staff session.
export async function POST(request: Request) {
  const s = await getPortalSession()
  if (!s) return unauthorized()
  const body = await parseBody(portalIssueSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => reportPortalIssue(s.organizationId, s.customerId, s.userId, body.data), { created: true })
}
