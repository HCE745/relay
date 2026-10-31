import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { payPeriodCreateSchema } from "@/lib/zod-schemas"
import { listPayPeriods, createPayPeriod } from "@/lib/data/pay-periods"

const CAP = "workforce.payrollExport"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listPayPeriods(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(payPeriodCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createPayPeriod(g.orgId, body.data), { created: true })
}
