import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, badRequest } from "@/lib/api"
import { exclusionLinkSchema } from "@/lib/zod-schemas"
import { linkExclusionRecord } from "@/lib/data/service-areas"

const CAP = "operations.serviceAreas"
type Ctx = { params: Promise<{ kind: string; id: string }> }

// Link / relink the incident to a customer + service location and set incident
// metadata (date, property-specific). Snapshots the customer name server-side.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { kind, id } = await params
  if (kind !== "address") return badRequest("Only address exclusions can be linked")
  const b = await parseBody(exclusionLinkSchema, request); if (!b.ok) return b.response
  return runWrite(() => linkExclusionRecord(g.orgId, g.session.userId, id, b.data))
}
