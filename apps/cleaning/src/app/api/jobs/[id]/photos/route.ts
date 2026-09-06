import { requireCleaner } from "@/lib/guards"
import { runWrite, badRequest } from "@/lib/api"
import { validatePhoto } from "@/lib/storage"
import { uploadJobPhoto } from "@/lib/data/photos"

const CAP = "workforce.mobileFieldApp"
type Ctx = { params: Promise<{ id: string }> }

// Multipart proof-of-service upload. Actor (uploader) comes from the session.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id } = await params

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return badRequest("A photo file is required")

  const buf = Buffer.from(await file.arrayBuffer())
  const contentType = file.type
  const err = validatePhoto(contentType, buf.length)
  if (err) return badRequest(err)

  const jobChecklistItemId = form.get("jobChecklistItemId")?.toString() || undefined
  const issueId = form.get("issueId")?.toString() || undefined
  const caption = form.get("caption")?.toString() || undefined

  return runWrite(
    () =>
      uploadJobPhoto(g.orgId, id, g.userId, {
        data: buf,
        contentType,
        sizeBytes: buf.length,
        jobChecklistItemId,
        issueId,
        caption,
      }),
    { created: true },
  )
}
