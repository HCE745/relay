import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireSession } from "@/lib/session"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import type { ScanResult } from "@/lib/scan-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number]

const MAX_FILE_BYTES = 20 * 1024 * 1024

function normalizeImageMediaType(raw: string): ImageMediaType {
  if ((IMAGE_MEDIA_TYPES as readonly string[]).includes(raw)) return raw as ImageMediaType
  if (raw.includes("jpeg") || raw.includes("jpg")) return "image/jpeg"
  if (raw.includes("png")) return "image/png"
  if (raw.includes("gif")) return "image/gif"
  if (raw.includes("webp")) return "image/webp"
  return "image/jpeg"
}

function buildSystemPrompt(
  vendors: { id: string; name: string }[],
  accounts: { id: string; code: string; name: string }[]
): string {
  const vendorList = vendors.length
    ? vendors.map((v) => `  - id: ${JSON.stringify(v.id)}, name: ${JSON.stringify(v.name)}`).join("\n")
    : "  (none configured yet)"

  const accountList = accounts.length
    ? accounts.map((a) => `  - id: ${JSON.stringify(a.id)}, code: ${JSON.stringify(a.code)}, name: ${JSON.stringify(a.name)}`).join("\n")
    : "  (none configured yet)"

  return `You are a receipt OCR assistant with access to this company's vendor list and chart of accounts. Extract data from the provided receipt or invoice (image or PDF) and return ONLY valid JSON — no prose, no markdown fences, no explanation.

EXISTING VENDORS — if the receipt clearly shows one of these vendors, set matchedVendorId to that vendor's id. If uncertain or the vendor is not listed, set matchedVendorId to null.
${vendorList}

EXPENSE ACCOUNTS (chart of accounts) — use ONLY these ids for suggestedAccountId and overallSuggestedAccountId. If no account fits, use null.
${accountList}

Return exactly this JSON shape:
{
  "vendorName": string or null,
  "matchedVendorId": string or null,
  "date": "YYYY-MM-DD" or null,
  "currency": "USD",
  "subtotalCents": integer or null,
  "taxCents": integer or null,
  "totalCents": integer or null,
  "lineItems": [
    {
      "description": string,
      "amountCents": integer,
      "suggestedAccountId": string or null,
      "suggestedAccountName": string
    }
  ],
  "overallSuggestedAccountId": string or null,
  "isLikelyRecurring": boolean,
  "recurringReason": string or null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- Convert all money to integer cents (multiply dollars by 100 and round). Example: $12.50 → 1250.
- matchedVendorId MUST be an id from the EXISTING VENDORS list above, or null.
- suggestedAccountId and overallSuggestedAccountId MUST be ids from the EXPENSE ACCOUNTS list above, or null. Pick the most semantically appropriate account. For multi-line receipts, pick per-line accounts when distinct categories are clear; set overallSuggestedAccountId to the best single account if all lines share a category.
- isLikelyRecurring: true for subscriptions, utilities, rent, recurring software (SaaS), insurance, loan payments, etc. false for one-time purchases.
- recurringReason: short explanation when isLikelyRecurring is true (e.g. "monthly SaaS subscription", "recurring utility bill"), null otherwise.
- confidence: "high" if the receipt is clear and all major fields are readable; "medium" if some amounts are uncertain; "low" if poor quality or many fields missing.
- lineItems: include individual line items when visible. Empty array [] if no detail lines.
- For multi-page PDFs, combine all pages into one result.
- Return ONLY the JSON object — nothing before or after it.`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured on server" }, { status: 500 })
  }

  let fileBase64: string
  let fileType: string

  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("file") as File | null
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File too large — maximum 20 MB" }, { status: 413 })
      }
      const buffer = await file.arrayBuffer()
      fileBase64 = Buffer.from(buffer).toString("base64")
      fileType = file.type
    } else {
      const body = await req.json()
      if (!body.fileBase64) return NextResponse.json({ error: "No file provided" }, { status: 400 })
      fileBase64 = body.fileBase64 as string
      fileType = body.mediaType ?? "image/jpeg"
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const isPdf = fileType === "application/pdf"
  const isImage = fileType.startsWith("image/")
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 415 })
  }

  // Fetch vendor + account context so the model can match against real data
  let vendors: { id: string; name: string }[] = []
  let accounts: { id: string; code: string; name: string }[] = []
  try {
    const session = await requireSession()
    const entityId = await getSelectedEntityId()
    ;[vendors, accounts] = await Promise.all([
      prisma.vendor.findMany({
        where: { tenantId: session.tenantId, entityId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.account.findMany({
        where: { tenantId: session.tenantId, entityId, type: "EXPENSE", isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
    ])
  } catch {
    // Proceed without context if session/DB fails — still useful for basic extraction
  }

  const fileContentBlock: Anthropic.MessageParam["content"][number] = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: normalizeImageMediaType(fileType), data: fileBase64 } }

  const client = new Anthropic({ apiKey })

  let raw: string
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(vendors, accounts),
      messages: [
        {
          role: "user",
          content: [
            fileContentBlock,
            { type: "text", text: "Extract the receipt data and return the JSON." },
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

  // Validate that any IDs the model returned are actually from our lists
  const vendorIds = new Set(vendors.map((v) => v.id))
  const accountIds = new Set(accounts.map((a) => a.id))

  if (parsed.matchedVendorId && !vendorIds.has(parsed.matchedVendorId)) {
    parsed.matchedVendorId = null
  }
  if (parsed.overallSuggestedAccountId && !accountIds.has(parsed.overallSuggestedAccountId)) {
    parsed.overallSuggestedAccountId = null
  }
  if (Array.isArray(parsed.lineItems)) {
    parsed.lineItems = parsed.lineItems.map((li) => ({
      ...li,
      suggestedAccountId: li.suggestedAccountId && accountIds.has(li.suggestedAccountId)
        ? li.suggestedAccountId
        : null,
    }))
  } else {
    parsed.lineItems = []
  }

  return NextResponse.json(parsed)
}
