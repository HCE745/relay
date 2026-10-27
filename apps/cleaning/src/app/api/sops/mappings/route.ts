import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { sopMappingSchema } from "@/lib/zod-schemas"
import { orgDb } from "@/lib/org-db"
const CAP = "operations.sopLibrary"
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(sopMappingSchema, request); if (!body.ok) return body.response
  return runWrite(async () => {
    await orgDb(g.orgId).sopIssueMapping.create({ data: { organizationId: g.orgId, issueCategory: body.data.issueCategory as never, sopId: body.data.sopId } }).catch(() => {})
    return { ok: true }
  }, { created: true })
}
export async function DELETE(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(sopMappingSchema, request); if (!body.ok) return body.response
  return runWrite(async () => {
    await orgDb(g.orgId).sopIssueMapping.deleteMany({ where: { issueCategory: body.data.issueCategory as never, sopId: body.data.sopId } })
    return { ok: true }
  })
}
