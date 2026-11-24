import { getSession } from "@/lib/session"
import { isPlatformAdmin } from "@/lib/platform-admin"
import { notFound, forbidden, unauthorized } from "@/lib/api"
import { getStorage } from "@/lib/storage"
import { getFeedbackAttachmentAny } from "@/lib/data/feedback"

export const runtime = "nodejs"
type Ctx = { params: Promise<{ id: string }> }

// Feedback attachments are PRIVATE CleanWare product data. Streamed server-side
// only to platform admins — a customer org role (even OWNER) can never reach it.
export async function GET(_request: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (!isPlatformAdmin(session)) return forbidden()
  const { id } = await params
  const att = await getFeedbackAttachmentAny(id)
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
