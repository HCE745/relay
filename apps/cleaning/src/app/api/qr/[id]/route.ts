import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { qrActiveSchema } from "@/lib/zod-schemas"
import { setQrCodeActive } from "@/lib/data/qr-codes"

const CAP = "operations.issues"

// Revoke (isActive:false) or reactivate ONE code — never touches the others.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(qrActiveSchema, request); if (!body.ok) return body.response
  return runWrite(() => setQrCodeActive(g.orgId, g.userId, id, body.data.isActive))
}
