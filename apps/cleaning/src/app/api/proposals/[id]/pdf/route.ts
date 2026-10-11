import { requireAccountManager } from "@/lib/guards"
import { notFound } from "@/lib/api"
import { orgDb } from "@/lib/org-db"
import { proposalPdfByToken } from "@/lib/data/proposals"
const CAP = "crm.estimates"
type Ctx = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const p = await orgDb(g.orgId).proposal.findFirst({ where: { id }, select: { token: true } })
  if (!p) return notFound()
  const pdf = await proposalPdfByToken(p.token)
  if (!pdf) return notFound()
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="proposal.pdf"`, "cache-control": "private, no-store" } })
}
