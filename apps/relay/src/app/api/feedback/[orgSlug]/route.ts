import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { classifyFeedback } from "@/lib/classify-feedback"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await params

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, customer_voice_enabled: true },
  })

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!org.customer_voice_enabled) return NextResponse.json({ error: "Feedback not enabled" }, { status: 403 })

  const body = await req.json() as {
    rating?: unknown
    feedbackText?: unknown
    customerName?: unknown
    customerEmail?: unknown
    locationSlug?: unknown
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 })
  }

  const feedbackText  = typeof body.feedbackText  === "string" ? body.feedbackText.trim()  || null : null
  const customerName  = typeof body.customerName  === "string" ? body.customerName.trim()  || null : null
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() || null : null
  const locationSlug  = typeof body.locationSlug  === "string" ? body.locationSlug.trim()  || null : null

  let locationId: string | null = null
  if (locationSlug) {
    const loc = await prisma.location.findFirst({
      where: { organizationId: org.id, slug: locationSlug },
      select: { id: true },
    })
    locationId = loc?.id ?? null
  }

  const cls = await classifyFeedback(rating, feedbackText)

  await prisma.customerFeedback.create({
    data: {
      organizationId:  org.id,
      locationId,
      source:          "FEEDBACK_LINK",
      rating,
      feedbackText,
      customerName,
      customerContact: customerEmail,
      submittedAt:     new Date(),
      aiClassification: cls.aiClassification,
      aiSentiment:      cls.aiSentiment,
      aiUrgency:        cls.aiUrgency,
      aiSummary:        cls.aiSummary,
      aiConfidence:     cls.aiConfidence,
      status:           cls.status,
    },
  })

  return NextResponse.json({ ok: true })
}
