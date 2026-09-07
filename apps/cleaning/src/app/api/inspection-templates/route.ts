import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { inspectionTemplateCreateSchema } from "@/lib/zod-schemas"
import { createInspectionTemplate, listInspectionTemplates } from "@/lib/data/inspection-templates"

const CAP = "quality.inspections"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listInspectionTemplates(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(inspectionTemplateCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createInspectionTemplate(g.orgId, body.data), { created: true })
}
