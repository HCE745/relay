import { requireAccountManager } from "@/lib/guards"
import { canManageOrg } from "@/lib/rbac"
import { forbidden, parseBody, runWrite } from "@/lib/api"
import { payPeriodUnlockSchema } from "@/lib/zod-schemas"
import { unlockPeriod } from "@/lib/data/pay-periods"

const CAP = "workforce.payrollExport"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  // Only OWNER/ADMIN may unlock a locked period; MANAGER/SUPERVISOR cannot.
  if (!canManageOrg(g.session.role)) return forbidden("Only an owner or admin can unlock a pay period")
  const { id } = await params
  const body = await parseBody(payPeriodUnlockSchema, request); if (!body.ok) return body.response
  return runWrite(() => unlockPeriod(g.orgId, id, g.session.userId!, body.data.reason))
}
