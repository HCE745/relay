import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { employeeSkillsSchema } from "@/lib/zod-schemas"
import { setEmployeeSkills } from "@/lib/data/skills"

const CAP = "workforce.coverage"

// Replace an employee's skill set (the management grid sends the full list).
export async function PATCH(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(employeeSkillsSchema, request); if (!body.ok) return body.response
  return runWrite(() => setEmployeeSkills(g.orgId, body.data.userId, body.data.skillIds))
}
