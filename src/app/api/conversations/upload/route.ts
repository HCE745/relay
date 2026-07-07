import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { put } from "@vercel/blob"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 })
  }

  const blob = await put(`messages/${Date.now()}-${file.name}`, file, { access: "public" })

  return NextResponse.json({
    url:  blob.url,
    name: file.name,
    type: file.type,
  })
}
