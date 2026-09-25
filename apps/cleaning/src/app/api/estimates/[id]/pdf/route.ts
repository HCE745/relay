import { requireAccountManager } from "@/lib/guards"
import { notFound } from "@/lib/api"
import { getEstimatePdf } from "@/lib/data/documents"

const CAP = "crm.estimates"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const pdf = await getEstimatePdf(g.orgId, id)
  if (!pdf) return notFound()
  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${pdf.filename}"`,
      "cache-control": "private, no-store",
    },
  })
}
