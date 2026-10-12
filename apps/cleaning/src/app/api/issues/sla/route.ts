import { requireOperations } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { getIssueSla, upsertIssueSlaRule, type Severity } from "@/lib/data/issue-sla"
const CAP = "operations.issues"
export async function GET() {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  return ok(await getIssueSla(g.orgId))
}
const schema = z.object({ severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), ackMinutes: z.coerce.number().int().min(1).max(100000), resolveMinutes: z.coerce.number().int().min(1).max(1000000) })
export async function PATCH(request: Request) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const body = await parseBody(schema, request); if (!body.ok) return body.response
  return runWrite(() => upsertIssueSlaRule(g.orgId, body.data.severity as Severity, body.data.ackMinutes, body.data.resolveMinutes))
}
