import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { onboardingPacketSchema } from "@/lib/zod-schemas"
import { listPackets, createPacket } from "@/lib/data/onboarding"

const CAP = "workforce.hiring"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listPackets(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(onboardingPacketSchema, request); if (!body.ok) return body.response
  return runWrite(() => createPacket(g.orgId, body.data), { created: true })
}
