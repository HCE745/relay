import { requireStaff } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { employeeReportAssignSchema } from "@/lib/zod-schemas"
import { assignReviewer } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"

const CAP = "operations.employeeReports"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireStaff(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(employeeReportAssignSchema, request)
  if (!body.ok) return body.response
  const actor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() => assignReviewer(g.orgId, actor, id, body.data.reviewerId))
}
