import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite, badRequest } from "@/lib/api"
import { custodyActionSchema } from "@/lib/zod-schemas"
import {
  checkoutAccessItem, checkinAccessItem, transferAccessItem, reportAccessItemLost, replaceAccessItem,
  checkoutAsset, checkinAsset, transferAsset, reportAssetLost,
} from "@/lib/data/custody"

const CAP = "operations.accessControl"

// Record a custody movement. OWNER/ADMIN/MANAGER/SUPERVISOR only (requireOperations);
// cleaners cannot. One endpoint dispatches on kind + action.
export async function POST(request: Request) {
  const g = await requireOperations(CAP); if (!g.ok) return g.response
  const body = await parseBody(custodyActionSchema, request); if (!body.ok) return body.response
  const { kind, itemId, action, toUserId, jobId, identifier, notes } = body.data
  const by = g.userId
  const n = notes ?? null

  if (kind === "ACCESS") {
    switch (action) {
      case "CHECKED_OUT":
        if (!toUserId) return badRequest("Choose who is taking it")
        return runWrite(() => checkoutAccessItem(g.orgId, itemId, { toUserId, jobId: jobId ?? null, notes: n }, by))
      case "CHECKED_IN":
        return runWrite(() => checkinAccessItem(g.orgId, itemId, n, by))
      case "TRANSFERRED":
        if (!toUserId) return badRequest("Choose who it is transferring to")
        return runWrite(() => transferAccessItem(g.orgId, itemId, toUserId, n, by))
      case "REPORTED_LOST":
        return runWrite(() => reportAccessItemLost(g.orgId, itemId, n, by))
      case "REPLACED":
        if (!identifier) return badRequest("Give the replacement an identifier")
        return runWrite(() => replaceAccessItem(g.orgId, itemId, { identifier, notes: n }, by), { created: true })
    }
  } else {
    switch (action) {
      case "CHECKED_OUT":
        if (!toUserId) return badRequest("Choose who is taking it")
        return runWrite(() => checkoutAsset(g.orgId, itemId, { toUserId, jobId: jobId ?? null, notes: n }, by))
      case "CHECKED_IN":
        return runWrite(() => checkinAsset(g.orgId, itemId, n, by))
      case "TRANSFERRED":
        if (!toUserId) return badRequest("Choose who it is transferring to")
        return runWrite(() => transferAsset(g.orgId, itemId, toUserId, n, by))
      case "REPORTED_LOST":
        return runWrite(() => reportAssetLost(g.orgId, itemId, n, by))
      case "REPLACED":
        return badRequest("Replacement applies to keys and access items, not assets")
    }
  }
  return badRequest("Unsupported custody action")
}
