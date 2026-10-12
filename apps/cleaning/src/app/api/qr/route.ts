import { requireOperations } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { qrCodeCreateSchema } from "@/lib/zod-schemas"
import { listQrCodes, createQrCode } from "@/lib/data/qr-codes"

const CAP = "operations.issues"

export async function GET() {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  return ok(await listQrCodes(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const body = await parseBody(qrCodeCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createQrCode(g.orgId, g.userId, body.data), { created: true })
}
