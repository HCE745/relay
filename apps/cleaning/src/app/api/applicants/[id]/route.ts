import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { applicantUpdateSchema } from "@/lib/zod-schemas"
import { updateApplicant } from "@/lib/data/hiring"
const CAP = "workforce.hiring"
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(applicantUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateApplicant(g.orgId, id, body.data))
}
