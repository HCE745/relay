import { getSession } from "@/lib/session"
import { unauthorized, notFound } from "@/lib/api"
import { getPhotoForServe } from "@/lib/data/photos"

type Ctx = { params: Promise<{ id: string }> }

// Serve a proof photo's bytes, org-scoped (any authenticated member of the org).
export async function GET(_request: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return unauthorized()
  const { id } = await params
  const photo = await getPhotoForServe(session.organizationId, id)
  if (!photo) return notFound()
  return new Response(new Uint8Array(photo.bytes), {
    headers: { "content-type": photo.contentType, "cache-control": "private, max-age=3600" },
  })
}
