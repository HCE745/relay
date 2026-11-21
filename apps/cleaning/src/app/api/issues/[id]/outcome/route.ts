import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { complaintOutcomeSchema } from "@/lib/zod-schemas"
import { recordComplaintOutcome } from "@/lib/data/complaints"

const CAP = "operations.issues"
type Ctx = { params: Promise<{ id: string }> }

// Record the investigation outcome + finding on a customer complaint (P3).
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(complaintOutcomeSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => recordComplaintOutcome(g.orgId, g.userId, id, body.data))
}
