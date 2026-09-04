import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { SurveyResults } from "@/components/surveys/survey-results"
import Link from "next/link"
import { CloseButton } from "./close-button"

export const dynamic = "force-dynamic"

export default async function SurveyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) redirect("/surveys")

  const { id } = await params

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      responses: { include: { answers: true, respondent: { select: { id: true, name: true } } } },
    },
  })

  if (!survey || survey.organizationId !== session.organizationId) notFound()

  const isAdminOrHR = session.role === "ADMIN" || session.role === "HR"

  const totalResponses = survey.responses.length

  // Aggregate per question (mirrors the API route logic)
  const questionResults = survey.questions.map(q => {
    const answers = survey.responses.flatMap(r => r.answers.filter(a => a.questionId === q.id))

    if (q.type === "RATING") {
      const values = answers.map(a => a.ratingValue).filter((v): v is number => v != null)
      const avg    = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
      const dist   = [1, 2, 3, 4, 5].map(v => ({ value: v, count: values.filter(x => x === v).length }))
      return { questionId: q.id, type: q.type, text: q.text, avg, distribution: dist, count: values.length }
    }
    if (q.type === "YES_NO") {
      const yes = answers.filter(a => a.boolValue === true).length
      const no  = answers.filter(a => a.boolValue === false).length
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
    return {
      questionId: q.id, type: q.type, text: q.text,
      responses: answers.map(a => a.textValue).filter(Boolean),
      count: answers.length,
    }
  })

  // Longitudinal: sibling surveys (same title, CLOSED)
  const siblings = await prisma.survey.findMany({
    where: { organizationId: session.organizationId, title: survey.title, status: "CLOSED", id: { not: id } },
    orderBy: { closedAt: "asc" },
    include: { questions: { orderBy: { order: "asc" } }, responses: { include: { answers: true } } },
  })

  const longitudinal: Record<string, Array<{ surveyId: string; closedAt: string; avg: number; responseCount: number }>> = {}
  const ratingQs = survey.questions.filter(q => q.type === "RATING")

  for (const rq of ratingQs) {
    const series: Array<{ surveyId: string; closedAt: string; avg: number; responseCount: number }> = []
    for (const sib of siblings) {
      const mq = sib.questions.find(q => q.text === rq.text && q.type === "RATING")
      if (!mq) continue
      const vals = sib.responses.flatMap(r => r.answers.filter(a => a.questionId === mq.id)).map(a => a.ratingValue).filter((v): v is number => v != null)
      if (!vals.length) continue
      series.push({ surveyId: sib.id, closedAt: (sib.closedAt ?? sib.updatedAt).toISOString(), avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100, responseCount: vals.length })
    }
    const thisVals = survey.responses.flatMap(r => r.answers.filter(a => a.questionId === rq.id)).map(a => a.ratingValue).filter((v): v is number => v != null)
    if (thisVals.length) series.push({ surveyId: survey.id, closedAt: (survey.closedAt ?? survey.updatedAt).toISOString(), avg: Math.round(thisVals.reduce((a, b) => a + b, 0) / thisVals.length * 100) / 100, responseCount: thisVals.length })
    if (series.length > 1) longitudinal[rq.id] = series
  }

  return (
    <div>
      <Header title={`Results: ${survey.title}`} />
      <div className="md:hidden px-4 pt-4 pb-2">
        <Link href="/surveys" className="text-sm text-blue-600 hover:underline">← Surveys</Link>
      </div>
      <div className="px-3 md:px-6 py-4 md:py-8 max-w-3xl space-y-4">
        {/* Status + actions row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              survey.status === "ACTIVE" ? "bg-green-100 text-green-800" :
              survey.status === "CLOSED" ? "bg-blue-100 text-blue-800"  : "bg-gray-100 text-gray-500"
            }`}>
              {survey.status}
            </span>
            <span className="text-sm text-gray-500">{totalResponses} response{totalResponses !== 1 ? "s" : ""}</span>
          </div>
          {isAdminOrHR && survey.status === "ACTIVE" && (
            <CloseButton surveyId={survey.id} />
          )}
        </div>

        <SurveyResults
          totalResponses={totalResponses}
          questionResults={questionResults}
          longitudinal={longitudinal}
          closedAt={survey.closedAt?.toISOString() ?? null}
        />
      </div>
    </div>
  )
}
