import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canViewResults = ["ADMIN", "HR", "MANAGER"].includes(session.role)
  if (!canViewResults) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      responses: {
        include: {
          answers:   true,
          respondent: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!survey || survey.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const totalResponses = survey.responses.length

  // Aggregate per question
  const questionResults = survey.questions.map(q => {
    const answers = survey.responses.flatMap(r => r.answers.filter(a => a.questionId === q.id))

    if (q.type === "RATING") {
      const values = answers.map(a => a.ratingValue).filter((v): v is number => v != null)
      const avg    = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
      const dist   = [1, 2, 3, 4, 5].map(v => ({ value: v, count: values.filter(x => x === v).length }))
      return { questionId: q.id, type: q.type, text: q.text, avg, distribution: dist, count: values.length }
    }

    if (q.type === "YES_NO") {
      const yes  = answers.filter(a => a.boolValue === true).length
      const no   = answers.filter(a => a.boolValue === false).length
      return { questionId: q.id, type: q.type, text: q.text, yes, no, count: yes + no }
    }

    if (q.type === "MULTIPLE_CHOICE") {
      const options = (q.options as string[] | null) ?? []
      const tally   = new Map<string, number>()
      for (const opt of options) tally.set(opt, 0)
      for (const a of answers) { if (a.choiceValue) tally.set(a.choiceValue, (tally.get(a.choiceValue) ?? 0) + 1) }
      return {
        questionId: q.id, type: q.type, text: q.text,
        options: Array.from(tally.entries()).map(([option, count]) => ({ option, count })),
        count: answers.length,
      }
    }

    // FREE_TEXT
    return {
      questionId: q.id, type: q.type, text: q.text,
      responses: answers.map(a => a.textValue).filter(Boolean),
      count: answers.length,
    }
  })

  // Longitudinal data — find other surveys in org with same title, compute avg rating per RATING question
  const siblings = await prisma.survey.findMany({
    where: {
      organizationId: session.organizationId,
      title:   survey.title,
      status:  "CLOSED",
      id:      { not: id },
    },
    orderBy: { closedAt: "asc" },
    include: {
      questions: { orderBy: { order: "asc" } },
      responses: { include: { answers: true } },
    },
  })

  // For each RATING question in this survey, build a longitudinal series
  const longitudinal: Record<string, Array<{ surveyId: string; closedAt: string; avg: number; responseCount: number }>> = {}

  const ratingQuestions = survey.questions.filter(q => q.type === "RATING")
  for (const rq of ratingQuestions) {
    const series: Array<{ surveyId: string; closedAt: string; avg: number; responseCount: number }> = []

    for (const sibling of siblings) {
      const matchingQ = sibling.questions.find(q => q.text === rq.text && q.type === "RATING")
      if (!matchingQ) continue
      const values = sibling.responses
        .flatMap(r => r.answers.filter(a => a.questionId === matchingQ.id))
        .map(a => a.ratingValue)
        .filter((v): v is number => v != null)
      if (values.length === 0) continue
      series.push({
        surveyId:      sibling.id,
        closedAt:      (sibling.closedAt ?? sibling.updatedAt).toISOString(),
        avg:           Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        responseCount: values.length,
      })
    }

    // Add this survey if it's closed
    const thisValues = survey.responses
      .flatMap(r => r.answers.filter(a => a.questionId === rq.id))
      .map(a => a.ratingValue)
      .filter((v): v is number => v != null)
    if (thisValues.length > 0) {
      series.push({
        surveyId:      survey.id,
        closedAt:      (survey.closedAt ?? survey.updatedAt).toISOString(),
        avg:           Math.round((thisValues.reduce((a, b) => a + b, 0) / thisValues.length) * 100) / 100,
        responseCount: thisValues.length,
      })
    }

    if (series.length > 1) longitudinal[rq.id] = series
  }

  return NextResponse.json({
    survey: {
      id:          survey.id,
      title:       survey.title,
      description: survey.description,
      status:      survey.status,
      isAnonymous: survey.isAnonymous,
      closedAt:    survey.closedAt,
      createdAt:   survey.createdAt,
    },
    totalResponses,
    questionResults,
    longitudinal,
  })
}
