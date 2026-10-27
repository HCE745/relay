import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { sopSchema } from "@/lib/zod-schemas"
import { updateSopDraft } from "@/lib/data/sops"
const CAP = "operations.sopLibrary"
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(sopSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateSopDraft(g.orgId, id, g.session.userId!, body.data))
}
