import { requireOperations } from "@/lib/guards"
import { ok, parseBody } from "@/lib/api"
import { routingPreviewSchema } from "@/lib/zod-schemas"
import { routeIssue } from "@/lib/data/issue-routing"

const CAP = "operations.issues"

// Dry-run: show which rule (or the default) a hypothetical issue would hit,
// without creating anything.
export async function POST(request: Request) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const body = await parseBody(routingPreviewSchema, request); if (!body.ok) return body.response
  const decision = await routeIssue(g.orgId, {
    category: body.data.category,
    severity: body.data.severity,
    source: body.data.source,
    serviceLocationId: body.data.serviceLocationId ?? null,
  })
  return ok(decision)
}
