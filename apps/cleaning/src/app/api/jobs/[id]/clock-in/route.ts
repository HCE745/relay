import { requireCleaner } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { clockSchema } from "@/lib/zod-schemas"
import { clockIn } from "@/lib/scheduling/execution"

const CAP = "workforce.timeTracking"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(clockSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => clockIn(g.orgId, id, g.userId, body.data))
}
