import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  })

  if (!survey || survey.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (survey.status !== "ACTIVE") {
    return NextResponse.json({ error: "This survey is not currently accepting responses" }, { status: 400 })
  }

  // Check for existing response (only for identified surveys)
  if (!survey.isAnonymous) {
    const existing = await prisma.surveyResponse.findFirst({
      where: { surveyId: id, respondentId: session.userId },
    })
    if (existing) {
      return NextResponse.json({ error: "You have already submitted a response to this survey" }, { status: 409 })
    }
  }

  const { answers } = await request.json() as {
    answers: Array<{
      questionId: string
      ratingValue?: number
      boolValue?: boolean
      choiceValue?: string
      textValue?: string
    }>
  }

  // Validate required questions are answered
  const answersMap = new Map(answers.map(a => [a.questionId, a]))
  for (const q of survey.questions) {
    if (!q.required) continue
    const answer = answersMap.get(q.id)
    if (!answer) return NextResponse.json({ error: `Question "${q.text}" is required` }, { status: 400 })
    const hasValue =
      (q.type === "RATING"          && answer.ratingValue != null) ||
      (q.type === "YES_NO"          && answer.boolValue   != null) ||
      (q.type === "MULTIPLE_CHOICE" && answer.choiceValue?.trim()) ||
      (q.type === "FREE_TEXT"       && answer.textValue?.trim())
    if (!hasValue) return NextResponse.json({ error: `Question "${q.text}" is required` }, { status: 400 })
  }

  const response = await prisma.surveyResponse.create({
    data: {
      surveyId:    id,
      respondentId: survey.isAnonymous ? null : session.userId,
      answers: {
        create: answers
          .filter(a => survey.questions.some(q => q.id === a.questionId))
          .map(a => ({
            questionId:  a.questionId,
            ratingValue: a.ratingValue ?? null,
            boolValue:   a.boolValue   ?? null,
            choiceValue: a.choiceValue ?? null,
            textValue:   a.textValue   ?? null,
          })),
      },
    },
    include: { answers: true },
  })

  return NextResponse.json(response, { status: 201 })
}
