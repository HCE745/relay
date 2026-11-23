import { requireInspector } from "@/lib/guards"
import { runWrite, badRequest } from "@/lib/api"
import { createInspectionForSite } from "@/lib/scheduling/inspections"

const CAP = "quality.inspections"

// Create an ad-hoc inspection at a service location (not tied to a job). The
// inspector defaults to the current user but may be set explicitly.
export async function POST(request: Request) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const body = (await request.json().catch(() => null)) as { serviceLocationId?: string; templateId?: string; inspectorId?: string } | null
  const serviceLocationId = String(body?.serviceLocationId || "")
  const templateId = String(body?.templateId || "")
  const inspectorId = body?.inspectorId ? String(body.inspectorId) : g.userId
  if (!serviceLocationId) return badRequest("A service location is required")
  if (!templateId) return badRequest("An inspection template is required")
  return runWrite(() => createInspectionForSite(g.orgId, serviceLocationId, inspectorId, templateId), { created: true })
}
