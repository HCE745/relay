import { requireStaff } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { getReport } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"

const CAP = "operations.employeeReports"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireStaff(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const actor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() => getReport(g.orgId, actor, id))
}
