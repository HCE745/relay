import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { classifyFeedback } from "@/lib/classify-feedback"
import { createHash } from "crypto"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  // ── Auth: Bearer API key ─────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? ""
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (!rawKey) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401, headers: CORS })
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex")
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, organizationId: true, isActive: true },
  })

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401, headers: CORS })
  }

  // Update lastUsedAt async — don't block the response
  void prisma.apiKey.update({
    where: { id: apiKey.id },
    data:  { lastUsedAt: new Date() },
  }).catch(() => undefined)

  // ── Validate org has Customer Voice enabled ──────────────────────────────────
  const org = await prisma.organization.findUnique({
    where:  { id: apiKey.organizationId },
    select: { customer_voice_enabled: true },
  })
  if (!org?.customer_voice_enabled) {
    return NextResponse.json({ error: "Customer Voice not enabled" }, { status: 403, headers: CORS })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS })
  }

  const {
    source,
    rating: rawRating,
    feedbackText,
    customerName,
    customerEmail,
    locationIdentifier,
    submittedAt: rawSubmittedAt,
    externalId,
    metadata,
  } = body

  // Must have at least rating or text
  if (rawRating == null && (typeof feedbackText !== "string" || !feedbackText.trim())) {
    return NextResponse.json({ error: "Provide at least one of rating or feedbackText" }, { status: 400, headers: CORS })
  }

  // Normalise rating (accept 1-5 or 0-10 NPS scale)
  let rating: number | null = null
  if (rawRating != null) {
    const n = Number(rawRating)
    if (!isNaN(n)) {
      rating = n > 5 ? Math.max(1, Math.min(5, Math.round((n / 10) * 4) + 1)) : Math.max(1, Math.min(5, Math.round(n)))
    }
  }

  const text    = typeof feedbackText === "string" ? feedbackText.trim() || null : null
  const name    = typeof customerName  === "string" ? customerName.trim()  || null : null
  const contact = typeof customerEmail === "string" ? customerEmail.trim() || null : null
  const extId   = typeof externalId   === "string" ? externalId.trim()    || null : null
  const sourceName = typeof source === "string" ? source.trim() || "WEBHOOK" : "WEBHOOK"

  // ── Deduplication ────────────────────────────────────────────────────────────
  if (extId) {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "CustomerFeedback"
      WHERE "organizationId" = ${apiKey.organizationId}
        AND source = 'WEBHOOK'
        AND "externalId" = ${extId}
      LIMIT 1
    `
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, id: existing[0]!.id, duplicate: true }, { headers: CORS })
    }
  }

  // ── Location matching ────────────────────────────────────────────────────────
  let locationId: string | null = null
  if (typeof locationIdentifier === "string" && locationIdentifier.trim()) {
    const id = locationIdentifier.trim()
    const loc = await prisma.location.findFirst({
      where: {
        organizationId: apiKey.organizationId,
        OR: [
          { id },
          { name:  { equals: id, mode: "insensitive" } },
          { slug: id.toLowerCase() },
        ],
      },
      select: { id: true },
    })
    locationId = loc?.id ?? null
  }

  // ── AI Classification ────────────────────────────────────────────────────────
  const effectiveRating = rating ?? 3
  const cls = await classifyFeedback(effectiveRating, text)

  // ── Create feedback record ───────────────────────────────────────────────────
  const submittedAt = rawSubmittedAt && typeof rawSubmittedAt === "string"
    ? new Date(rawSubmittedAt) : new Date()

  const record = await prisma.customerFeedback.create({
    data: {
      organizationId:  apiKey.organizationId,
      locationId,
      source:          "WEBHOOK",
      externalId:      extId,
      rating,
      feedbackText:    text,
      customerName:    name,
      customerContact: contact,
      submittedAt,
      aiClassification: cls.aiClassification,
      aiSentiment:      cls.aiSentiment,
      aiUrgency:        cls.aiUrgency,
      aiSummary:        cls.aiSummary,
      aiConfidence:     cls.aiConfidence,
      status:           cls.status,
      sourceMetadata:  {
        sourcePlatform: sourceName,
        ...(metadata && typeof metadata === "object" ? metadata as object : {}),
      },
    },
    select: { id: true },
  })

  return NextResponse.json({ ok: true, id: record.id }, { headers: CORS })
}
