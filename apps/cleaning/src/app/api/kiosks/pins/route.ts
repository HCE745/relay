import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { clockPinSchema } from "@/lib/zod-schemas"
import { setClockPin, listPinStatus } from "@/lib/data/kiosks"

const CAP = "workforce.timeTracking"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listPinStatus(g.orgId))
}

export async function PATCH(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(clockPinSchema, request); if (!body.ok) return body.response
  return runWrite(() => setClockPin(g.orgId, body.data.userId, body.data.pin))
}
