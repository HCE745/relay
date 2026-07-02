import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { put } from "@vercel/blob"
import { cookies } from "next/headers"
import { getSession } from "@/lib/session"
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

EXPENSE ACCOUNTS (chart of accounts) — use ONLY these ids for suggestedAccountId and overallSuggestedAccountId. Set suggestedAccountName to the human-readable account name even when suggestedAccountId is null.
${accountList}

Return exactly this JSON shape:
{
  "vendorName": string,
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
- vendorName is REQUIRED — never return null. Identify the vendor/merchant/company that issued this receipt or invoice (the business being paid). Look everywhere: company name, logo text, letterhead, "From:", "Billed by:", "Sold by:", domain name in URLs or email addresses, email sender name, header, or footer. If the document is an emailed invoice, the sender company name in the header or footer is the vendor. Make your best determination — use a domain name (e.g. "godaddy.com") if no full company name is visible. Only return null as an absolute last resort if the document contains no business or company identifier whatsoever.
- Convert all money to integer cents. Example: $12.50 → 1250.
- matchedVendorId MUST be an id from the EXISTING VENDORS list above, or null.
- suggestedAccountId MUST be an id from the EXPENSE ACCOUNTS list above, or null. ALWAYS set suggestedAccountName to the best category name even if suggestedAccountId is null.
- overallSuggestedAccountId: best single expense account for the whole receipt (id or null).
- overallSuggestedAccountName: category name for the whole receipt even if id is null.
- isLikelyRecurring: true for subscriptions, utilities, rent, recurring SaaS, insurance, etc.
- recurringReason: short explanation when isLikelyRecurring is true, null otherwise.
- confidence: "high" if clear; "medium" if some uncertain; "low" if poor quality.
- lineItems: include individual line items when visible. Empty array [] if none.
- For multi-page PDFs, combine all pages into one result.
- Return ONLY the JSON object — nothing before or after it.`
}

function fuzzyMatchAccount(
  name: string,
  accounts: { id: string; code: string; name: string }[]
): string | null {
  if (!name || !accounts.length) return null
  const lower = name.toLowerCase().trim()
  const exact = accounts.find((a) => a.name.toLowerCase() === lower)
  if (exact) return exact.id
  const words = lower.split(/\s+/).filter((w) => w.length > 3)
  for (const word of words) {
    const m = accounts.find((a) => a.name.toLowerCase().includes(word))
    if (m) return m.id
  }
  for (const acc of accounts) {
    const accLower = acc.name.toLowerCase()
    if (lower.includes(accLower) || accLower.includes(lower)) return acc.id
  }
  return null
}

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

  let fileBase64: string
  let fileType: string
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

  // Use getSession() (non-redirecting) so a missing cookie doesn't throw NEXT_REDIRECT
  // into our catch block and silently wipe out vendor/account context.
  let vendors: { id: string; name: string }[] = []
  let accounts: { id: string; code: string; name: string }[] = []
  let sessionTenantId: string | null = null
  let sessionEntityId: string | null = null

  // ── Auth + entity context ────────────────────────────────────────────────────
  console.log("[scan] env check — SESSION_SECRET set:", !!process.env.SESSION_SECRET,
    "| ANTHROPIC_API_KEY set:", !!apiKey)

  const session = await getSession()
  if (session) {
    try {
      const cookieStore = await cookies()
      const entityCookieId = cookieStore.get("hce-entity")?.value
      const sessionEntities = await prisma.entity.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { name: "asc" },
        select: { id: true },
      })
      const resolvedEntity = sessionEntities.find((e) => e.id === entityCookieId) ?? sessionEntities[0]
      sessionTenantId = session.tenantId
      sessionEntityId = resolvedEntity?.id ?? null

      console.log("[scan] session OK — tenantId:", sessionTenantId,
        "| entityCookie:", entityCookieId ?? "(not set)",
        "| resolvedEntityId:", sessionEntityId ?? "(none)")

      if (!sessionEntityId) {
        console.warn("[scan] No entity found for tenant — vendor/account context unavailable")
      } else {
        ;[vendors, accounts] = await Promise.all([
          prisma.vendor.findMany({
            where: { tenantId: session.tenantId, entityId: sessionEntityId, isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
          prisma.account.findMany({
            where: { tenantId: session.tenantId, entityId: sessionEntityId, type: "EXPENSE", isActive: true },
            orderBy: { code: "asc" },
            select: { id: true, code: true, name: true },
          }),
        ])
      }
    } catch (err) {
      console.error("[scan] DB fetch failed:", err)
    }
  } else {
    console.warn("[scan] NO SESSION — getSession() returned null. " +
      "Check that SESSION_SECRET is set in Vercel env vars and matches the secret used to sign the session cookie.")
  }

  console.log("[scan] context — tenantId:", sessionTenantId ?? "NULL",
    "| entityId:", sessionEntityId ?? "NULL",
    "| vendors:", vendors.length,
    "| accounts:", accounts.length)

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
    console.log("RAW MODEL OUTPUT:", raw)
  } catch (e) {
    const msg = (e as Error).message ?? "API error"
    console.error("[scan] Anthropic API error:", msg)
    return NextResponse.json({ error: `Receipt scan failed: ${msg}` }, { status: 502 })
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()

  let parsed: ScanResult & { overallSuggestedAccountName?: string | null }
  try {
    parsed = JSON.parse(cleaned)
    console.log("PARSED SCAN:", JSON.stringify(parsed, null, 2))
  } catch {
    console.error("[scan] JSON parse failed. Raw:", raw)
    return NextResponse.json({ error: "Couldn't read receipt, enter manually" }, { status: 422 })
  }

  // DIAG: log what the model returned for vendor (remove after confirming fix)
  console.log("[scan] model returned vendor:", {
    vendorName: parsed.vendorName,
    matchedVendorId: parsed.matchedVendorId,
  })

  const vendorIds = new Set(vendors.map((v) => v.id))
  const accountIds = new Set(accounts.map((a) => a.id))

  // Vendor: validate → fuzzy-match by name → create if still unresolved
  if (parsed.matchedVendorId && !vendorIds.has(parsed.matchedVendorId)) {
    console.log("[scan] model matchedVendorId not in list, clearing:", parsed.matchedVendorId)
    parsed.matchedVendorId = null
  }
  let existingMatchId: string | null = null
  if (!parsed.matchedVendorId && parsed.vendorName) {
    existingMatchId = fuzzyMatchVendor(parsed.vendorName, vendors)
    if (existingMatchId) {
      parsed.matchedVendorId = existingMatchId
      console.log("[scan] fuzzy-matched vendor:", parsed.matchedVendorId)
    }
  }

  // If vendor still unresolved and we have a session, create the vendor now so the
  // dropdown can show a real selected option instead of "Select…".
  let createdVendorName: string | null = null
  let createdVendorId: string | null = null
  console.log("VENDOR HANDLING:", {
    extractedVendorName: parsed.vendorName ?? "NONE FROM MODEL",
    entityId: sessionEntityId,
    willCreate: !!(parsed.vendorName && !parsed.matchedVendorId && sessionTenantId && sessionEntityId),
    vendorsInContext: vendors.length,
  })
  if (!parsed.matchedVendorId && parsed.vendorName && sessionTenantId && sessionEntityId) {
    try {
      const newVendor = await prisma.vendor.create({
        data: { tenantId: sessionTenantId, entityId: sessionEntityId, name: parsed.vendorName },
      })
      parsed.matchedVendorId = newVendor.id
      createdVendorName = newVendor.name
      createdVendorId = newVendor.id
      console.log("[scan] created vendor:", newVendor.id, newVendor.name)
    } catch (err) {
      console.error("[scan] failed to create vendor:", err)
    }
  }

  console.log("SCAN VENDOR DEBUG:", {
    rawExtractedVendorName: parsed.vendorName ?? null,
    entityId: sessionEntityId ?? null,
    vendorsAvailableForMatching: vendors.length,
    foundExisting: existingMatchId ?? null,
    didCreate: createdVendorId !== null,
    matchedVendorId: parsed.matchedVendorId ?? null,
  })
  // Legacy log kept for consistency
  console.log("VENDOR STEP:", {
    extractedName: parsed.vendorName,
    sessionTenantId,
    sessionEntityId,
    vendorsInDb: vendors.length,
    foundExisting: existingMatchId ?? "none",
    createdNew: createdVendorId ?? "none",
    finalMatchedVendorId: parsed.matchedVendorId ?? "none",
  })

  // Line accounts: validate → fuzzy-match by name
  if (Array.isArray(parsed.lineItems)) {
    parsed.lineItems = parsed.lineItems.map((li) => {
      let id = li.suggestedAccountId && accountIds.has(li.suggestedAccountId) ? li.suggestedAccountId : null
      if (!id && li.suggestedAccountName) {
        id = fuzzyMatchAccount(li.suggestedAccountName, accounts)
      }
      return { ...li, suggestedAccountId: id }
    })
  } else {
    parsed.lineItems = []
  }

  // Overall account: validate → fuzzy-match → derive from lines
  if (parsed.overallSuggestedAccountId && !accountIds.has(parsed.overallSuggestedAccountId)) {
    parsed.overallSuggestedAccountId = null
  }
  if (!parsed.overallSuggestedAccountId && parsed.overallSuggestedAccountName) {
    parsed.overallSuggestedAccountId = fuzzyMatchAccount(parsed.overallSuggestedAccountName, accounts)
  }
  if (!parsed.overallSuggestedAccountId && parsed.lineItems.length > 0) {
    const firstWithAccount = parsed.lineItems.find((l) => l.suggestedAccountId)
    if (firstWithAccount) parsed.overallSuggestedAccountId = firstWithAccount.suggestedAccountId
  }

  // Blob upload (production only — requires BLOB_READ_WRITE_TOKEN)
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

  const result: ScanResult & { createdVendorName?: string | null } = {
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
    createdVendorName: createdVendorName ?? null,
  }

  console.log("SCAN RESPONSE:", JSON.stringify({
    vendorName: result.vendorName,
    matchedVendorId: result.matchedVendorId,
    createdVendorName: result.createdVendorName,
    date: result.date,
    totalCents: result.totalCents,
    overallSuggestedAccountId: result.overallSuggestedAccountId,
    confidence: result.confidence,
    lineItemCount: result.lineItems.length,
  }, null, 2))

  console.log("FINAL RESPONSE:", JSON.stringify(result, null, 2))
  return NextResponse.json(result)
}
