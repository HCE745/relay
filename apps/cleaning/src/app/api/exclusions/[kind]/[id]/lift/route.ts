import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, badRequest } from "@/lib/api"
import { exclusionLiftSchema } from "@/lib/zod-schemas"
import { liftExclusion } from "@/lib/data/service-areas"

const CAP = "operations.serviceAreas"
type Ctx = { params: Promise<{ kind: string; id: string }> }

// Lift an address exclusion (management, after review). Preserves the record and
// its customer association — status becomes LIFTED, never deleted.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { kind, id } = await params
  if (kind !== "address") return badRequest("Only address exclusions can be lifted")
  const b = await parseBody(exclusionLiftSchema, request); if (!b.ok) return b.response
  return runWrite(() => liftExclusion(g.orgId, g.session.userId, id, b.data.reason))
}
