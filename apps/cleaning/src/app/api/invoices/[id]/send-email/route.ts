import { requireAccountManager } from "@/lib/guards"
import { runWrite, forbidden } from "@/lib/api"
import { isEmailConfigured } from "@/lib/email"
import { sendInvoiceEmail } from "@/lib/data/documents"

const CAP = "billing.invoicing"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  // Defense in depth: the UI hides Send when unconfigured; refuse here too.
  if (!isEmailConfigured()) return forbidden("Email delivery is not configured")
  const { id } = await params
  return runWrite(() => sendInvoiceEmail(g.orgId, id))
}
