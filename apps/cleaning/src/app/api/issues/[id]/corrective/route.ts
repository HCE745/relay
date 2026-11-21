import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { complaintCorrectiveSchema } from "@/lib/zod-schemas"
import { assignCorrectiveWork } from "@/lib/data/complaints"

const CAP = "operations.issues"
type Ctx = { params: Promise<{ id: string }> }

// Create + assign corrective rework for a complaint (P3). The assignee is
// notified with neutral wording that never exposes the complaint or finding.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(complaintCorrectiveSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => assignCorrectiveWork(g.orgId, g.userId, id, body.data), { created: true })
}
