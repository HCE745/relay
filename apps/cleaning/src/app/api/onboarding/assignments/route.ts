import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { onboardingAssignSchema } from "@/lib/zod-schemas"
import { assignPacket } from "@/lib/data/onboarding"

const CAP = "workforce.hiring"

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(onboardingAssignSchema, request); if (!body.ok) return body.response
  return runWrite(() => assignPacket(g.orgId, body.data.packetId, body.data.userId, g.session.userId), { created: true })
}
