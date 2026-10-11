import { orgDb } from "../org-db"
import { ReferenceError, ConflictError } from "./errors"

// Portal quote approval (Phase 28). A customer approves/declines an estimate
// that was shared with them (estimate.customerId == this customer). Approval
// marks it ACCEPTED; staff then finalize/convert — the portal never converts.

export function listPortalQuotes(orgId: string, customerId: string) {
  return orgDb(orgId).estimate.findMany({
    where: { customerId, status: "SENT", convertedCustomerId: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, total: true, currency: true, validUntil: true },
  })
}

export async function portalDecideQuote(orgId: string, customerId: string, estimateId: string, decision: "APPROVED" | "DECLINED") {
  const est = await orgDb(orgId).estimate.findFirst({ where: { id: estimateId, customerId, convertedCustomerId: null }, select: { id: true, status: true } })
  if (!est) throw new ReferenceError("That quote isn't available")
  if (est.status !== "SENT") throw new ConflictError(`This quote is already ${est.status.toLowerCase()}`)
  await orgDb(orgId).estimate.updateMany({ where: { id: estimateId, status: "SENT" }, data: { status: decision === "APPROVED" ? "ACCEPTED" : "DECLINED" } })
  return { ok: true }
}
