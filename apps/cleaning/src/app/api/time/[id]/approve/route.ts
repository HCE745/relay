import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { approveTimeEntry } from "@/lib/data/time-entries"

const CAP = "workforce.timesheetApproval"
type Ctx = { params: Promise<{ id: string }> }

// Manager+ approval (payroll-sensitive; supervisors excluded — no team scope yet).
export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => approveTimeEntry(g.orgId, id, g.session.userId))
}
