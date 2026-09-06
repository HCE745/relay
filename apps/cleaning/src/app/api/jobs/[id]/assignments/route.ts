import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { assignCleanerSchema } from "@/lib/zod-schemas"
import { assignCleaner } from "@/lib/data/assignments"

const CAP = "workforce.assignments"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(assignCleanerSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => assignCleaner(g.orgId, id, body.data.userId), { created: true })
}
