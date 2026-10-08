import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, badRequest } from "@/lib/api"
import { excludedAddressSchema, excludedContactSchema, excludedZoneSchema } from "@/lib/zod-schemas"
import { createExcludedAddress, createExcludedContact, createExcludedZone } from "@/lib/data/service-areas"
const CAP = "operations.serviceAreas"
type Ctx = { params: Promise<{ kind: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { kind } = await params
  const actor = g.session.userId
  if (kind === "address") {
    const body = await parseBody(excludedAddressSchema, request); if (!body.ok) return body.response
    return runWrite(() => createExcludedAddress(g.orgId, actor, body.data), { created: true })
  }
  if (kind === "contact") {
    const body = await parseBody(excludedContactSchema, request); if (!body.ok) return body.response
    return runWrite(() => createExcludedContact(g.orgId, actor, body.data), { created: true })
  }
  if (kind === "zone") {
    const body = await parseBody(excludedZoneSchema, request); if (!body.ok) return body.response
    return runWrite(() => createExcludedZone(g.orgId, actor, body.data), { created: true })
  }
  return badRequest("Unknown exclusion kind")
}
