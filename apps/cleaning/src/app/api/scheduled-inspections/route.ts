import { requireInspector } from "@/lib/guards"
import { runWrite, badRequest } from "@/lib/api"
import { createScheduledInspection, type Cadence } from "@/lib/scheduling/scheduled-inspections"

const CAP = "quality.inspections"
const CADENCES = new Set<Cadence>(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY"])

export async function POST(request: Request) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const serviceLocationId = String(b?.serviceLocationId || "")
  const templateId = String(b?.templateId || "")
  const cadence = String(b?.cadence || "") as Cadence
  const firstRunAt = new Date(String(b?.firstRunAt || ""))
  if (!serviceLocationId || !templateId) return badRequest("Site and template are required")
  if (!CADENCES.has(cadence)) return badRequest("Invalid cadence")
  if (Number.isNaN(firstRunAt.getTime())) return badRequest("Invalid first run date")

  const randomizeInspector = Boolean(b?.randomizeInspector)
  const inspectorPoolIds = Array.isArray(b?.inspectorPoolIds) ? (b!.inspectorPoolIds as unknown[]).map(String) : []
  const assignedInspectorId = b?.assignedInspectorId ? String(b.assignedInspectorId) : null
  const reminderLeadHours = Number(b?.reminderLeadHours)

  return runWrite(
    () =>
      createScheduledInspection(g.orgId, g.userId, {
        serviceLocationId, templateId, cadence, firstRunAt,
        reminderLeadHours: Number.isFinite(reminderLeadHours) ? reminderLeadHours : undefined,
        randomizeInspector, inspectorPoolIds, assignedInspectorId,
      }),
    { created: true },
  )
}
