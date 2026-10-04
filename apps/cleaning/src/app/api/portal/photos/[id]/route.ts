import { getPortalSession } from "@/lib/portal-session"
import { unauthorized, notFound } from "@/lib/api"
import { getPortalPhoto } from "@/lib/data/portal"
import { getStorage } from "@/lib/storage"

type Ctx = { params: Promise<{ id: string }> }

// Serve a proof photo ONLY when it belongs to the portal user's customer.
export async function GET(_request: Request, { params }: Ctx) {
  const s = await getPortalSession()
  if (!s) return unauthorized()
  const { id } = await params
  const photo = await getPortalPhoto(s.organizationId, s.customerId, id)
  if (!photo) return notFound()
  const bytes = await getStorage().get(photo.storageKey)
  if (!bytes) return notFound()
  return new Response(new Uint8Array(bytes), { headers: { "content-type": photo.contentType, "cache-control": "private, max-age=3600" } })
}
