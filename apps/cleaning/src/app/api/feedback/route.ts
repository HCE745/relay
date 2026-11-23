import { randomBytes } from "node:crypto"
import { requireStaff } from "@/lib/guards"
import { badRequest, ok } from "@/lib/api"
import { getStorage } from "@/lib/storage"
import { isDemoOrg } from "@/lib/demo/provision"
import {
  createFeedback, validateFeedbackFile, extForFeedback,
  type FeedbackKind, type AttachmentKind, type NewAttachment,
} from "@/lib/data/feedback"

export const runtime = "nodejs"

const TYPES = new Set<FeedbackKind>(["BUG", "FEATURE", "QUESTION"])
// Multipart field name → attachment kind. Each may repeat.
const FILE_FIELDS: Record<string, AttachmentKind> = {
  screenshot: "SCREENSHOT",
  recording: "RECORDING",
  upload: "UPLOAD",
}

export async function POST(request: Request) {
  const g = await requireStaff()
  if (!g.ok) return g.response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest("Expected multipart form data")
  }

  const type = String(form.get("type") || "").toUpperCase() as FeedbackKind
  if (!TYPES.has(type)) return badRequest("Unknown feedback type")
  const title = String(form.get("title") || "").trim()
  const description = String(form.get("description") || "").trim()
  if (!title) return badRequest("A short title is required")
  if (!description) return badRequest("Please describe the issue or request")

  const consentVisual = String(form.get("consent") || "") === "1"
  const pageUrl = String(form.get("pageUrl") || "").trim() || undefined
  const userAgent = request.headers.get("user-agent") || undefined

  // Collect + validate every attached file before storing any of them.
  const files: { kind: AttachmentKind; file: File }[] = []
  for (const [field, kind] of Object.entries(FILE_FIELDS)) {
    for (const entry of form.getAll(field)) {
      if (entry instanceof File && entry.size > 0) files.push({ kind, file: entry })
    }
  }
  if (files.length > 6) return badRequest("Attach at most 6 files")
  // Visual evidence requires explicit consent.
  if (files.length > 0 && !consentVisual) {
    return badRequest("Please confirm consent before attaching visual evidence")
  }

  const storage = getStorage()
  const attachments: NewAttachment[] = []
  for (const { kind, file } of files) {
    const buf = Buffer.from(await file.arrayBuffer())
    const err = validateFeedbackFile(file.type, buf.length)
    if (err) return badRequest(err)
    const key = `feedback/${g.orgId}/${randomBytes(12).toString("hex")}.${extForFeedback(file.type)}`
    const ref = await storage.put(key, buf, file.type)
    attachments.push({ kind, storageRef: ref, contentType: file.type, sizeBytes: buf.length, name: file.name || undefined })
  }

  const row = await createFeedback(
    g.orgId,
    { id: g.userId, name: g.session.name, email: g.session.email },
    { type, title, description, pageUrl, userAgent, consentVisual, isDemo: await isDemoOrg(g.orgId) },
    attachments,
  )
  return ok({ id: row.id }, 201)
}
