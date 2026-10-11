import { notFound } from "@/lib/api"
import { proposalPdfByToken } from "@/lib/data/proposals"
type Ctx = { params: Promise<{ token: string }> }
export async function GET(_request: Request, { params }: Ctx) {
  const { token } = await params
  const pdf = await proposalPdfByToken(token)
  if (!pdf) return notFound()
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": 'inline; filename="proposal.pdf"', "cache-control": "private, no-store" } })
}
