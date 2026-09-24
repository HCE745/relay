import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { convertEstimate } from "@/lib/data/estimates"

const CAP = "crm.estimates"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => convertEstimate(g.orgId, id), { created: true })
}
