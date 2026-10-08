import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, badRequest } from "@/lib/api"
import { excludedAddressUpdateSchema, excludedContactUpdateSchema, excludedZoneUpdateSchema } from "@/lib/zod-schemas"
import {
  updateExcludedAddress, updateExcludedContact, updateExcludedZone,
  deleteExcludedAddress, deleteExcludedContact, deleteExcludedZone,
} from "@/lib/data/service-areas"
const CAP = "operations.serviceAreas"
type Ctx = { params: Promise<{ kind: string; id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { kind, id } = await params
  const actor = g.session.userId
  if (kind === "address") { const b = await parseBody(excludedAddressUpdateSchema, request); if (!b.ok) return b.response; return runWrite(() => updateExcludedAddress(g.orgId, actor, id, b.data)) }
  if (kind === "contact") { const b = await parseBody(excludedContactUpdateSchema, request); if (!b.ok) return b.response; return runWrite(() => updateExcludedContact(g.orgId, actor, id, b.data)) }
  if (kind === "zone") { const b = await parseBody(excludedZoneUpdateSchema, request); if (!b.ok) return b.response; return runWrite(() => updateExcludedZone(g.orgId, actor, id, b.data)) }
  return badRequest("Unknown exclusion kind")
}
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { kind, id } = await params
  const actor = g.session.userId
  const fn = kind === "address" ? deleteExcludedAddress : kind === "contact" ? deleteExcludedContact : kind === "zone" ? deleteExcludedZone : null
  if (!fn) return badRequest("Unknown exclusion kind")
  return runWrite(async () => ((await fn(g.orgId, actor, id)) ? { deleted: true } : null))
}
