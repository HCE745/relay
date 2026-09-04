import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getSession } from "@/lib/session"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024   // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024  // 200 MB (accommodates 3-min 1080p + compression overhead)

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
])

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = form.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  // Strip codec params (e.g. "video/webm;codecs=vp9,opus" → "video/webm")
  const mimeType = file.type.split(";")[0].trim()
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
  }

  const isVideo = mimeType.startsWith("video/")
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > limit) {
    return NextResponse.json(
      { error: `File too large. Max ${isVideo ? "200 MB for video" : "10 MB for images"}` },
      { status: 400 }
    )
  }

  const ext = file.name.split(".").pop() ?? "bin"
  const pathname = `relay/${session.organizationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  try {
    const blob = await put(pathname, file, {
      access: "private",
      contentType: mimeType,
    })

    return NextResponse.json({
      url:      blob.url,
      filename: file.name,
      mimeType,
      size:     file.size,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed"
    console.error("[upload] put() failed:", message)

    // Surface auth/config errors clearly; keep the raw message for debugging
    if (message.includes("No blob credentials") || message.includes("BLOB_READ_WRITE_TOKEN") || message.includes("No read-write token")) {
      return NextResponse.json(
        { error: "Media storage is not configured. Add BLOB_READ_WRITE_TOKEN to your environment variables." },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 })
  }
}
