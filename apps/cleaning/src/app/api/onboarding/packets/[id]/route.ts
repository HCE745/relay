import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { onboardingPacketUpdateSchema } from "@/lib/zod-schemas"
import { updatePacket } from "@/lib/data/onboarding"

const CAP = "workforce.hiring"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(onboardingPacketUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updatePacket(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Deactivate — existing assignments keep their snapshotted tasks.
  return runWrite(() => updatePacket(g.orgId, id, { isActive: false }))
}
