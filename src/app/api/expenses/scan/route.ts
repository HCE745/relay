import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { ScanResult } from "@/lib/scan-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SYSTEM_PROMPT = `You are a receipt OCR assistant. Extract data from the provided receipt or invoice image and return ONLY valid JSON — no prose, no markdown fences, no explanation.

Return exactly this shape:
{
  "vendorName": string or null,
  "date": "YYYY-MM-DD" or null,
  "currency": "USD",
  "subtotalCents": integer or null,
  "taxCents": integer or null,
  "totalCents": integer or null,
  "lineItems": [ { "description": string, "amountCents": integer } ],
  "confidence": "high" | "medium" | "low"
}

Rules:
- Convert all money to integer cents (multiply dollars by 100 and round). Example: $12.50 → 1250.
- If a field cannot be read clearly, use null and lower confidence.
- "confidence": "high" if the receipt is clear and all major fields are readable; "medium" if some amounts are uncertain; "low" if the image is poor or many fields are missing.
- lineItems: include individual purchased items/services when visible. If no detail lines are visible, return an empty array [].
- Return ONLY the JSON object — nothing before or after it.`

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number]

function normalizeMediaType(raw: string): AllowedMediaType {
  if ((ALLOWED_MEDIA_TYPES as readonly string[]).includes(raw)) return raw as AllowedMediaType
  if (raw.includes("jpeg") || raw.includes("jpg")) return "image/jpeg"
  if (raw.includes("png")) return "image/png"
  if (raw.includes("gif")) return "image/gif"
  if (raw.includes("webp")) return "image/webp"
  return "image/jpeg"
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured on server" }, { status: 500 })
  }

  let imageBase64: string
  let mediaType: AllowedMediaType

  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("image") as File | null
      if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 })
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString("base64")
      mediaType = normalizeMediaType(file.type)
    } else {
      const body = await req.json()
      if (!body.imageBase64) return NextResponse.json({ error: "No image provided" }, { status: 400 })
      imageBase64 = body.imageBase64 as string
      mediaType = normalizeMediaType(body.mediaType ?? "image/jpeg")
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  let raw: string
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: "Extract the receipt data from this image and return the JSON." },
          ],
        },
      ],
    })

    const block = message.content[0]
    if (block.type !== "text") throw new Error("Unexpected response type from model")
    raw = block.text
  } catch (e) {
    const msg = (e as Error).message ?? "API error"
    console.error("[scan] Anthropic API error:", msg)
    return NextResponse.json({ error: `Receipt scan failed: ${msg}` }, { status: 502 })
  }

  // Strip accidental markdown fences the model may add
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  let parsed: ScanResult
  try {
    parsed = JSON.parse(cleaned) as ScanResult
  } catch {
    console.error("[scan] JSON parse failed. Raw model output:", raw)
    return NextResponse.json({ error: "Couldn't read receipt, enter manually" }, { status: 422 })
  }

  return NextResponse.json(parsed)
}
