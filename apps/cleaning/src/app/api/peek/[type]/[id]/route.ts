import { requireOperations, requireAccountManager } from "@/lib/guards"
import { ok, badRequest } from "@/lib/api"
import { peekJob, peekCustomer, peekInvoice, peekIssue, peekEmployee } from "@/lib/data/peek"

// Essentials for a slide-over panel. Each type carries its own guard so a panel
// never leaks a screen the person can't reach (mirrors the list-page guards).
type Ctx = { params: Promise<{ type: string; id: string }> }

// The slide-over client (PeekHost) reads `j.data`, so every branch wraps its
// PeekData (or null → "not found") in { data } — returning the bare object made
// every panel render "this item is no longer available".
export async function GET(_request: Request, { params }: Ctx) {
  const { type, id } = await params
  switch (type) {
    case "job": { const g = await requireOperations("core.jobs"); if (!g.ok) return g.response; return ok({ data: await peekJob(g.orgId, id) }) }
    case "issue": { const g = await requireOperations("operations.issues"); if (!g.ok) return g.response; return ok({ data: await peekIssue(g.orgId, id) }) }
    case "customer": { const g = await requireAccountManager("core.customers"); if (!g.ok) return g.response; return ok({ data: await peekCustomer(g.orgId, id) }) }
    case "invoice": { const g = await requireAccountManager("billing.invoicing"); if (!g.ok) return g.response; return ok({ data: await peekInvoice(g.orgId, id) }) }
    case "employee": { const g = await requireAccountManager("workforce.employees"); if (!g.ok) return g.response; return ok({ data: await peekEmployee(g.orgId, id) }) }
    default: return badRequest("Unknown panel type")
  }
}
