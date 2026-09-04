import { NextRequest } from "next/server"
import { get } from "@vercel/blob"
import { getSession } from "@/lib/session"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const url = request.nextUrl.searchParams.get("url")
  if (!url) return new Response("Missing url param", { status: 400 })

  // Prevent SSRF — only proxy Vercel Blob URLs
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response("Invalid URL", { status: 400 })
  }
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) {
    return new Response("Invalid URL", { status: 400 })
  }

  try {
    const result = await get(url, { access: "private" })
    if (!result) return new Response("Not found", { status: 404 })

    const filename = parsed.pathname.split("/").pop() ?? "file"
    return new Response(result.stream, {
      headers: {
        "Content-Type":        result.blob.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control":       "private, max-age=3600",
      },
    })
  } catch (err) {
    console.error("[blob-proxy] get() failed:", err)
    return new Response("Failed to fetch attachment", { status: 502 })
  }
}
