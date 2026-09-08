import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { classifyFeedback } from "@/lib/classify-feedback"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ surveyToken: string }> },
) {
  const { surveyToken } = await params

  const survey = await prisma.customerSurvey.findUnique({
    where: { surveyToken },
    select: {
      id: true, organizationId: true, locationId: true,
      status: true, isAnonymous: true, questions: true,
      organization: { select: { customer_voice_enabled: true } },
    },
  })

  if (!survey || survey.status !== "ACTIVE") {
    return NextResponse.json({ error: "Survey not available" }, { status: 404 })
  }

  const body = await req.json() as {
    answers?: unknown
    customerName?: unknown
    customerEmail?: unknown
  }

  const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
    ? body.answers as Record<string, unknown>
    : {}

  const customerName  = !survey.isAnonymous && typeof body.customerName  === "string" ? body.customerName.trim()  || null : null
  const customerEmail = !survey.isAnonymous && typeof body.customerEmail === "string" ? body.customerEmail.trim() || null : null

  // Create the survey response
  await prisma.customerSurveyResponse.create({
    data: {
      surveyId:       survey.id,
      organizationId: survey.organizationId,
      locationId:     survey.locationId,
      answers:        answers as Record<string, string | number | boolean>,
      customerName,
      customerEmail,
    },
  })

  // Mirror to CustomerFeedback so it appears in the Customer Voice inbox
  // Compute a synthetic rating from any RATING or NPS answers
  const questions = Array.isArray(survey.questions)
    ? survey.questions as Array<{ id: string; type: string; text: string }>
    : []

  let overallRating: number | null = null
  let feedbackText: string | null = null
  const textParts: string[] = []

  for (const q of questions) {
    const val = answers[q.id]
    if (q.type === "RATING" && typeof val === "number") {
      overallRating = Math.max(1, Math.min(5, Math.round(val)))
    } else if (q.type === "NPS" && typeof val === "number") {
      // Normalise 0–10 NPS to 1–5 scale
      if (!overallRating) overallRating = Math.max(1, Math.min(5, Math.round((val / 10) * 4) + 1))
    } else if (q.type === "TEXT" && typeof val === "string" && val.trim()) {
      textParts.push(val.trim())
    }
  }
  if (textParts.length > 0) feedbackText = textParts.join(" | ")

  const effectiveRating = overallRating ?? 3
  const cls = await classifyFeedback(effectiveRating, feedbackText)

  await prisma.customerFeedback.create({
    data: {
      organizationId:  survey.organizationId,
      locationId:      survey.locationId,
      source:          "SURVEY",
      rating:          overallRating,
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
      sourceMetadata:  { surveyToken, surveyId: survey.id },
    },
  })

  return NextResponse.json({ ok: true })
}
