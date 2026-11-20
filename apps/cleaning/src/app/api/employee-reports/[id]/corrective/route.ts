import { requireStaff } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { employeeReportCorrectiveSchema } from "@/lib/zod-schemas"
import { setCorrectiveAction } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"

const CAP = "operations.employeeReports"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireStaff(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(employeeReportCorrectiveSchema, request)
  if (!body.ok) return body.response
  const actor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() =>
    setCorrectiveAction(g.orgId, actor, id, { action: body.data.action, dueAt: body.data.dueAt, assigneeId: body.data.assigneeId }),
  )
}
