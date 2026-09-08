import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { callHaiku } from "@/lib/ai-haiku"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const qrCode = await prisma.qrCode.findUnique({
    where: { token },
    select: {
      id:             true,
      organizationId: true,
      isActive:       true,
      locationId:     true,
      enabledActions: true,
      organization:   { select: { customer_voice_enabled: true } },
    },
  })

  if (!qrCode || !qrCode.isActive) {
    return NextResponse.json({ error: "QR code not found or inactive" }, { status: 404 })
  }

  if (!qrCode.organization.customer_voice_enabled) {
    return NextResponse.json({ error: "Feedback collection is not enabled" }, { status: 403 })
  }

  if (!qrCode.enabledActions.includes("FEEDBACK")) {
    return NextResponse.json({ error: "This QR code does not support feedback" }, { status: 400 })
  }

  const body = await req.json() as { rating?: unknown; comment?: unknown; name?: unknown }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be an integer between 1 and 5" }, { status: 400 })
  }

  const comment  = typeof body.comment === "string" ? body.comment.trim() : null
  const name     = typeof body.name    === "string" ? body.name.trim()    : null

  // Synthetic unique ID to satisfy the @unique constraint on googleReviewId
  const syntheticId = `qr_${qrCode.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  let aiClassification: string | null = null
  let aiSummary:        string | null = null
  let aiConfidence:     number | null = null

  // Run AI classification when there's enough text to analyze
  if (comment && comment.length >= 10) {
    try {
      const prompt = `Classify this customer feedback (rating: ${rating}/5). Return JSON only: {"classification":"ACTIONABLE"|"FEEDBACK"|"ARCHIVED","confidence":0.0-1.0,"summary":"one sentence"}\n\nFeedback: "${comment}"`
      const raw = await callHaiku(prompt)
      if (!raw) throw new Error("no response")
      const parsed = JSON.parse(raw) as { classification?: string; confidence?: number; summary?: string }
      aiClassification = parsed.classification ?? null
      aiConfidence     = typeof parsed.confidence === "number" ? parsed.confidence : null
      aiSummary        = parsed.summary ?? null
    } catch {
      // AI classification is best-effort — never block submission
    }
  }

  await prisma.customerReview.create({
    data: {
      organizationId:   qrCode.organizationId,
      locationId:       qrCode.locationId ?? null,
      googleReviewId:   syntheticId,
      reviewerName:     name ?? null,
      rating,
      reviewText:       comment ?? null,
      publishedAt:      new Date(),
      source:           "QR",
      qrCodeId:         qrCode.id,
      aiClassification: aiClassification ?? (rating <= 2 ? "ACTIONABLE" : "FEEDBACK"),
      aiConfidence,
      aiSummary,
      status:           rating <= 2 ? "ISSUE_RECOMMENDED" : "PENDING",
    },
  })

  return NextResponse.json({ ok: true })
}
