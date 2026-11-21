import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { complaintLinkTaskSchema } from "@/lib/zod-schemas"
import { linkComplaintTask } from "@/lib/data/complaints"

const CAP = "operations.issues"
type Ctx = { params: Promise<{ id: string }> }

// Link (or clear) the checklist task a complaint is about, then snapshot who was
// responsible for it (P3).
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(complaintLinkTaskSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => linkComplaintTask(g.orgId, g.userId, id, body.data.jobChecklistItemId ?? null))
}
