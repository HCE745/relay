import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { parseSOPSections } from "@/lib/sop-matching"

export const dynamic = "force-dynamic"

async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop()

  if (ext === "txt") {
    return buffer.toString("utf-8")
  }

  if (ext === "pdf") {
    try {
      // pdf-parse has a quirky default export
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>
      const result = await pdfParse(buffer)
      return result.text ?? ""
    } catch (err) {
      console.error("[SOP Upload] PDF parse failed:", err)
      throw new Error("Could not extract text from PDF. Try saving as a plain text file instead.")
    }
  }

  if (ext === "docx") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
      }
      const result = await mammoth.extractRawText({ buffer })
      return result.value ?? ""
    } catch (err) {
      console.error("[SOP Upload] DOCX parse failed:", err)
      throw new Error("Could not extract text from DOCX. Try copying the content into a plain text file.")
    }
  }

  throw new Error(`Unsupported file type: .${ext}. Please upload a PDF, DOCX, or TXT file.`)
}

async function analyzeSopContent(content: string): Promise<{
  title: string
  description: string
  category: string
  assetType: string
  version: string
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = `Analyze this Standard Operating Procedure document and extract structured metadata.

Document content (first 3000 characters):
${content.slice(0, 3000)}

Extract the following fields. Respond ONLY with valid JSON — no markdown, no explanation:
{
  "title": "<concise SOP title (5-10 words)>",
  "description": "<1-2 sentence summary of what this SOP covers>",
  "category": "<one of: GENERAL, MAINTENANCE, SAFETY, EQUIPMENT_BREAKDOWN, FACILITY, VEHICLE, EMPLOYEE, SUPPLY_SHORTAGE, CUSTOMER_COMPLAINT — choose the best match>",
  "assetType": "<one of: EQUIPMENT, VEHICLE, FACILITY, TOOL, TECHNOLOGY, OTHER — choose the best match, or GENERAL if not asset-specific>",
  "version": "<version number found in document, or 1.0 if none found>"
}

Rules:
- title: extract from document title/heading if present, otherwise derive from content
- description: plain language, no jargon
- category: match to the closest operational category
- assetType: GENERAL if the SOP applies to a process rather than a specific asset type
- version: look for "Version", "Rev", "v" followed by a number; default to "1.0"`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim()
    if (!text) return null

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as {
      title: string; description: string; category: string; assetType: string; version: string
    }
  } catch (err) {
    console.error("[SOP Upload] AI analysis failed:", err)
    return null
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 })
  }

  const ext = file.name.toLowerCase().split(".").pop()
  if (!["pdf", "docx", "txt"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Unsupported file type. Upload a PDF, DOCX, or TXT file." }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let content: string
  try {
    content = await extractText(buffer, file.name)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "No readable text found in the file." }, { status: 422 })
  }

  // Truncate very long content for storage (keep first 50k chars)
  const storedContent = content.slice(0, 50000)

  // Parse sections and run AI analysis in parallel
  const [sections, suggested] = await Promise.all([
    Promise.resolve(parseSOPSections(storedContent)),
    analyzeSopContent(storedContent),
  ])

  return NextResponse.json({
    content: storedContent,
    sections,
    filename: file.name,
    suggested: suggested ?? {
      title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      description: "",
      category: "GENERAL",
      assetType: "EQUIPMENT",
      version: "1.0",
    },
  })
}
