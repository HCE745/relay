import { requireAccountManager } from "@/lib/guards"
import { ok } from "@/lib/api"
import { findCoverageCandidates } from "@/lib/data/coverage"

const CAP = "workforce.coverage"
type Ctx = { params: Promise<{ jobId: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { jobId } = await params
  return ok(await findCoverageCandidates(g.orgId, jobId))
}
