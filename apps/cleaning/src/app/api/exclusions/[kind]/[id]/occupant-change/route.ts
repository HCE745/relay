import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, badRequest } from "@/lib/api"
import { occupantChangeSchema } from "@/lib/zod-schemas"
import { recordOccupantChange } from "@/lib/data/service-areas"

const CAP = "operations.serviceAreas"
type Ctx = { params: Promise<{ kind: string; id: string }> }

// Record a VERIFIED occupant change — documents the new occupant and enables a
// person-specific exclusion to be lifted without transferring old misconduct.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { kind, id } = await params
  if (kind !== "address") return badRequest("Only address exclusions track occupants")
  const b = await parseBody(occupantChangeSchema, request); if (!b.ok) return b.response
  return runWrite(() => recordOccupantChange(g.orgId, g.session.userId, id, b.data))
}
