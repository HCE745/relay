import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { ensurePayLink } from "@/lib/data/payments"
const CAP = "billing.onlinePayments"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => { const token = await ensurePayLink(g.orgId, id); return token ? { token } : null })
}
