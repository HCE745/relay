import { requireAccountManager } from "@/lib/guards"
import { notFound } from "@/lib/api"
import { getStorage } from "@/lib/storage"
import { getFeedbackAttachment } from "@/lib/data/feedback"

export const runtime = "nodejs"
type Ctx = { params: Promise<{ id: string }> }

// Feedback attachments are PRIVATE and management-only. Streamed server-side,
// org-scoped, after an account-manager guard — never a public URL.
export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager()
  if (!g.ok) return g.response
  const { id } = await params
  const att = await getFeedbackAttachment(g.orgId, id)
  if (!att) return notFound()
  const bytes = await getStorage().get(att.storageRef)
  if (!bytes) return notFound()
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": att.contentType,
      "content-disposition": `inline; filename="${(att.name || att.id).replace(/[^\w.\-]/g, "_")}"`,
      "cache-control": "private, max-age=3600",
    },
  })
}
