import { requireCleaner } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { reportProblemSchema } from "@/lib/zod-schemas"
import { reportProblem } from "@/lib/data/issues"

const CAP = "operations.issues"
type Ctx = { params: Promise<{ id: string }> }

// Field "Report a Problem" entry point (minimal Cleaning Issue; Phase 5 expands).
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(reportProblemSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => reportProblem(g.orgId, id, g.userId, body.data), { created: true })
}
