import { requireStaff } from "@/lib/guards"
import { runWrite, badRequest } from "@/lib/api"
import { validatePhoto } from "@/lib/storage"
import { addReportEvidence } from "@/lib/data/employee-reports"
import type { ActorRole } from "@/lib/employee-reports/access"

const CAP = "operations.employeeReports"
type Ctx = { params: Promise<{ id: string }> }

// Attach photographic evidence to a report. Access (reporter or authorized
// investigator) is enforced in the data layer; the stored photo is jobId-less,
// so it never appears in any job's proof-of-service gallery.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireStaff(CAP)
  if (!g.ok) return g.response
  const { id } = await params

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return badRequest("A photo file is required")
  const buf = Buffer.from(await file.arrayBuffer())
  const err = validatePhoto(file.type, buf.length)
  if (err) return badRequest(err)
  const caption = form.get("caption")?.toString() || undefined

  const actor = { userId: g.userId, role: g.session.role as ActorRole }
  return runWrite(
    () => addReportEvidence(g.orgId, actor, id, { data: buf, contentType: file.type, sizeBytes: buf.length, caption }),
    { created: true },
  )
}
