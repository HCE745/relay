import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { regenerateKioskToken } from "@/lib/data/kiosks"

const CAP = "workforce.timeTracking"
type Ctx = { params: Promise<{ id: string }> }

// Rotate the activation token; the new plaintext token is returned ONCE.
export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => regenerateKioskToken(g.orgId, id))
}
