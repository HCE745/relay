import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { kioskCreateSchema } from "@/lib/zod-schemas"
import { listKiosks, createKiosk } from "@/lib/data/kiosks"

const CAP = "workforce.timeTracking"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listKiosks(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(kioskCreateSchema, request); if (!body.ok) return body.response
  // The plaintext activation token is returned ONCE here (hashed at rest).
  return runWrite(() => createKiosk(g.orgId, body.data), { created: true })
}
