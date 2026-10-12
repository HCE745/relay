import { requireOperations } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { verifyIssue } from "@/lib/data/issues"
const CAP = "operations.issues"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => verifyIssue(g.orgId, id, g.userId))
}
