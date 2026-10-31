import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { lockPeriod } from "@/lib/data/pay-periods"

const CAP = "workforce.payrollExport"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => lockPeriod(g.orgId, id, g.session.userId!))
}
