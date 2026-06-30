import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { put } from "@vercel/blob"
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

EXISTING VENDORS — if the receipt clearly shows one of these vendors, set matchedVendorId to that vendor's id. If uncertain or not listed, set matchedVendorId to null.
${vendorList}

EXPENSE ACCOUNTS (chart of accounts) — use ONLY these ids for suggestedAccountId and overallSuggestedAccountId. Set suggestedAccountName to the human-readable account name even when suggestedAccountId is null (use your best guess for the category name, e.g. "Software & Subscriptions", so we can match it).
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
  "overallSuggestedAccountName": string or null,
  "isLikelyRecurring": boolean,
  "recurringReason": string or null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- Convert all money to integer cents (multiply dollars by 100 and round). Example: $12.50 → 1250.
- matchedVendorId MUST be an id from the EXISTING VENDORS list above, or null.
- suggestedAccountId MUST be an id from the EXPENSE ACCOUNTS list above, or null. ALWAYS set suggestedAccountName to the best category name even if suggestedAccountId is null.
- overallSuggestedAccountId: best single expense account for the whole receipt (id from list or null).
- overallSuggestedAccountName: category name for the whole receipt even if id is null.
- isLikelyRecurring: true for subscriptions, utilities, rent, recurring SaaS, insurance, etc.
- recurringReason: short explanation when isLikelyRecurring is true, null otherwise.
- confidence: "high" if clear and all major fields readable; "medium" if some uncertain; "low" if poor quality.
- lineItems: include individual line items when visible. Empty array [] if no detail lines.
- For multi-page PDFs, combine all pages into one result.
- Return ONLY the JSON object — nothing before or after it.`
}

// Fuzzy-match an account by name against the account list
function fuzzyMatchAccount(
  name: string,
  accounts: { id: string; code: string; name: string }[]
): string | null {
  if (!name || !accounts.length) return null
  const lower = name.toLowerCase().trim()

  // Exact name match
  const exact = accounts.find((a) => a.name.toLowerCase() === lower)
  if (exact) return exact.id

  // Keyword overlap: look for meaningful words (> 3 chars) in the suggestion name inside account names
  const words = lower.split(/\s+/).filter((w) => w.length > 3)
  for (const word of words) {
    const m = accounts.find((a) => a.name.toLowerCase().includes(word))
    if (m) return m.id
  }

  // Reverse: check if any account name appears inside the suggestion name
  for (const acc of accounts) {
    const accLower = acc.name.toLowerCase()
    if (lower.includes(accLower) || accLower.includes(lower)) return acc.id
  }

  return null
}

// Fuzzy-match a vendor by name against the vendor list
function fuzzyMatchVendor(
  name: string,
  vendors: { id: string; name: string }[]
): string | null {
  if (!name || !vendors.length) return null
  const lower = name.toLowerCase().trim()

  const exact = vendors.find((v) => v.name.toLowerCase() === lower)
  if (exact) return exact.id

  const contains = vendors.find(
    (v) => v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase())
  )
  return contains?.id ?? null
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured on server" }, { status: 500 })
  }

  // Parse the uploaded file first so we can fail fast on bad input
  let fileBase64: string
  let fileType: string
  let fileName: string = "receipt"
  let fileBuffer: Buffer | null = null

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
      fileBuffer = Buffer.from(buffer)
      fileBase64 = fileBuffer.toString("base64")
      fileType = file.type
      fileName = file.name ?? "receipt"
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

  // Fetch vendor + account context so the model can match against real data.
  // Log errors instead of silently swallowing — we still proceed but with empty lists.
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
  } catch (err) {
    console.error("[scan] Failed to load vendor/account context:", err)
    // Continue with empty lists — model will still extract names, and we fuzzy-match below
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

  let parsed: ScanResult & { overallSuggestedAccountName?: string | null }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.error("[scan] JSON parse failed. Raw model output:", raw)
    return NextResponse.json({ error: "Couldn't read receipt, enter manually" }, { status: 422 })
  }

  // Validate and enrich: ensure any returned IDs come from our lists,
  // then fuzzy-match by name as a fallback so dropdowns auto-select.
  const vendorIds = new Set(vendors.map((v) => v.id))
  const accountIds = new Set(accounts.map((a) => a.id))

  // Vendor: validate model ID → fallback to server-side fuzzy match by name
  if (parsed.matchedVendorId && !vendorIds.has(parsed.matchedVendorId)) {
    parsed.matchedVendorId = null
  }
  if (!parsed.matchedVendorId && parsed.vendorName) {
    parsed.matchedVendorId = fuzzyMatchVendor(parsed.vendorName, vendors)
  }

  // Line accounts: validate model ID → fallback to fuzzy match by suggestedAccountName
  if (Array.isArray(parsed.lineItems)) {
    parsed.lineItems = parsed.lineItems.map((li) => {
      let id = li.suggestedAccountId && accountIds.has(li.suggestedAccountId)
        ? li.suggestedAccountId
        : null
      if (!id && li.suggestedAccountName) {
        id = fuzzyMatchAccount(li.suggestedAccountName, accounts)
      }
      return { ...li, suggestedAccountId: id }
    })
  } else {
    parsed.lineItems = []
  }

  // Overall account: validate → fallback fuzzy → derive from line items
  if (parsed.overallSuggestedAccountId && !accountIds.has(parsed.overallSuggestedAccountId)) {
    parsed.overallSuggestedAccountId = null
  }
  if (!parsed.overallSuggestedAccountId && parsed.overallSuggestedAccountName) {
    parsed.overallSuggestedAccountId = fuzzyMatchAccount(parsed.overallSuggestedAccountName, accounts)
  }
  if (!parsed.overallSuggestedAccountId && parsed.lineItems.length > 0) {
    // Use the most common line account as the overall fallback
    const firstWithAccount = parsed.lineItems.find((l) => l.suggestedAccountId)
    if (firstWithAccount) parsed.overallSuggestedAccountId = firstWithAccount.suggestedAccountId
  }

  // Upload receipt to Vercel Blob for persistence (requires BLOB_READ_WRITE_TOKEN)
  let receiptUrl: string | null = null
  if (fileBuffer && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const ext = isPdf ? "pdf" : (fileType.split("/")[1] ?? "jpg")
      const pathname = `hce/receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const blob = await put(pathname, fileBuffer, {
        access: "public",
        contentType: fileType,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      receiptUrl = blob.url
    } catch (err) {
      console.error("[scan] Blob upload failed (non-fatal):", (err as Error).message)
    }
  }

  const result: ScanResult = {
    vendorName: parsed.vendorName ?? null,
    matchedVendorId: parsed.matchedVendorId ?? null,
    date: parsed.date ?? null,
    currency: parsed.currency ?? "USD",
    subtotalCents: parsed.subtotalCents ?? null,
    taxCents: parsed.taxCents ?? null,
    totalCents: parsed.totalCents ?? null,
    lineItems: parsed.lineItems,
    overallSuggestedAccountId: parsed.overallSuggestedAccountId ?? null,
    isLikelyRecurring: parsed.isLikelyRecurring ?? false,
    recurringReason: parsed.recurringReason ?? null,
    confidence: parsed.confidence ?? "medium",
    receiptUrl,
  }

  return NextResponse.json(result)
}
