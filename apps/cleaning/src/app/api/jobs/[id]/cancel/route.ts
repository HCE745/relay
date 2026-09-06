import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { cancelJob } from "@/lib/data/jobs"

const CAP = "core.jobs"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await cancelJob(g.orgId, id)) ? { cancelled: true } : null))
}
