import { requireStaff } from "@/lib/guards"
import { parseBody, parseQuery, runWrite } from "@/lib/api"
import { employeeReportCreateSchema, employeeReportListQuerySchema } from "@/lib/zod-schemas"
import { createReport, listReports } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"

const CAP = "operations.employeeReports"

// File a report (any internal staff). View/investigate access is enforced
// per-report in the data layer by confidentiality tier.
export async function POST(request: Request) {
  const g = await requireStaff(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(employeeReportCreateSchema, request)
  if (!body.ok) return body.response
  const actor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() => createReport(g.orgId, actor, body.data), { created: true })
}

// List reports the actor may see (management list, or own-filed with ?mine=1).
export async function GET(request: Request) {
  const g = await requireStaff(CAP)
  if (!g.ok) return g.response
  const q = parseQuery(employeeReportListQuerySchema, request.url)
  if (!q.ok) return q.response
  const actor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(() => listReports(g.orgId, actor, q.data))
}
