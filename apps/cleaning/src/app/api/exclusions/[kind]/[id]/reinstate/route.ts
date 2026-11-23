import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, badRequest } from "@/lib/api"
import { exclusionLiftSchema } from "@/lib/zod-schemas"
import { reinstateExclusion } from "@/lib/data/service-areas"

const CAP = "operations.serviceAreas"
type Ctx = { params: Promise<{ kind: string; id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { kind, id } = await params
  if (kind !== "address") return badRequest("Only address exclusions can be reinstated")
  const b = await parseBody(exclusionLiftSchema, request); if (!b.ok) return b.response
  return runWrite(() => reinstateExclusion(g.orgId, g.session.userId, id, b.data.reason))
}
