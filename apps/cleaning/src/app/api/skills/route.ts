import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { skillCreateSchema } from "@/lib/zod-schemas"
import { listSkills, createSkill } from "@/lib/data/skills"

const CAP = "workforce.coverage"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listSkills(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(skillCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createSkill(g.orgId, body.data.name), { created: true })
}
