import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { correctTimeSchema } from "@/lib/zod-schemas"
import { correctTimeEntry } from "@/lib/data/time-entries"

const CAP = "workforce.timesheetApproval"
type Ctx = { params: Promise<{ id: string }> }

// Correct a clock in/out with a required reason (audited). Editing an APPROVED
// entry clears approval and requires re-approval.
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(correctTimeSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => correctTimeEntry(g.orgId, id, g.session.userId, body.data))
}
