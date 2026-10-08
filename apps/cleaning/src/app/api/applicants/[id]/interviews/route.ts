import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { interviewCreateSchema } from "@/lib/zod-schemas"
import { addInterview } from "@/lib/data/hiring"
const CAP = "workforce.hiring"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(interviewCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => addInterview(g.orgId, id, body.data), { created: true })
}
