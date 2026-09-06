import { requireCleaner } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { setFieldJobNote } from "@/lib/scheduling/execution"

const CAP = "workforce.mobileFieldApp"
const schema = z.object({ note: z.string().trim().max(2000) })
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(schema, request)
  if (!body.ok) return body.response
  return runWrite(() => setFieldJobNote(g.orgId, id, g.userId, body.data.note))
}
