import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { updateOrgSettings } from "@/lib/data/org"

const CAP = "operations.issues"
const schema = z.object({ defaultIssueAssigneeId: z.string().optional().or(z.literal("").transform(() => null)).nullable() })

// Routing fallback owner — same operations gate as the rest of the routing page.
export async function PATCH(request: Request) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const body = await parseBody(schema, request); if (!body.ok) return body.response
  return runWrite(() => updateOrgSettings(g.orgId, { defaultIssueAssigneeId: body.data.defaultIssueAssigneeId ?? null }))
}
