import { requireCleaner } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { checklistItemUpdateSchema } from "@/lib/zod-schemas"
import { toggleChecklistItem } from "@/lib/scheduling/execution"

const CAP = "workforce.mobileFieldApp"
type Ctx = { params: Promise<{ id: string; itemId: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id, itemId } = await params
  const body = await parseBody(checklistItemUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => toggleChecklistItem(g.orgId, id, itemId, g.userId, body.data))
}
