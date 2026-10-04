import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { revealAccessSecret } from "@/lib/data/access"

// Reveal is restricted to OWNER/ADMIN/MANAGER (requireAccountManager) and every
// reveal is logged to AuditEvent in the data layer.
const CAP = "operations.accessControl"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => revealAccessSecret(g.orgId, id, g.session.userId))
}
