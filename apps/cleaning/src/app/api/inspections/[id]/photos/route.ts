import { requireInspector } from "@/lib/guards"
import { runWrite, badRequest } from "@/lib/api"
import { validatePhoto } from "@/lib/storage"
import { uploadInspectionPhoto } from "@/lib/data/photos"

const CAP = "quality.inspections"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireInspector(CAP)
  if (!g.ok) return g.response
  const { id } = await params

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return badRequest("A photo file is required")
  const buf = Buffer.from(await file.arrayBuffer())
  const err = validatePhoto(file.type, buf.length)
  if (err) return badRequest(err)

  const inspectionItemResultId = form.get("inspectionItemResultId")?.toString() || undefined
  const caption = form.get("caption")?.toString() || undefined

  return runWrite(
    () =>
      uploadInspectionPhoto(g.orgId, id, g.userId, {
        data: buf,
        contentType: file.type,
        sizeBytes: buf.length,
        inspectionItemResultId,
        caption,
      }),
    { created: true },
  )
}
