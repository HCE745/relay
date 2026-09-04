import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { SurveyTaker } from "@/components/surveys/survey-taker"
import Link from "next/link"
import { CheckCircle, Lock } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function TakeSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  })

  if (!survey || survey.organizationId !== session.organizationId) notFound()

  // Non-admin/manager employees only see ACTIVE surveys
  const isAdminOrHR = session.role === "ADMIN" || session.role === "HR"
  const isManager   = session.role === "MANAGER"
  if (!isAdminOrHR && !isManager && survey.status !== "ACTIVE") notFound()

  // Check if already responded
  const existing = await prisma.surveyResponse.findFirst({
    where: { surveyId: id, respondentId: session.userId },
    select: { id: true },
  })

  const alreadyResponded = !!existing

  if (alreadyResponded) {
    return (
      <div>
        <Header title={survey.title} />
        <div className="px-3 md:px-6 py-8 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Already submitted</h2>
            <p className="text-sm text-gray-500 mb-6">You&apos;ve already responded to this survey. Thank you for your feedback!</p>
            <Link href="/surveys" className="text-sm text-blue-600 hover:underline">← Back to surveys</Link>
          </div>
        </div>
      </div>
    )
  }

  if (survey.status === "CLOSED") {
    return (
      <div>
        <Header title={survey.title} />
        <div className="px-3 md:px-6 py-8 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Survey closed</h2>
            <p className="text-sm text-gray-500 mb-6">This survey is no longer accepting responses.</p>
            <Link href="/surveys" className="text-sm text-blue-600 hover:underline">← Back to surveys</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title={survey.title} />
      <div className="md:hidden px-4 pt-4 pb-2">
        <Link href="/surveys" className="text-sm text-blue-600 hover:underline">← Surveys</Link>
      </div>
      <div className="px-3 md:px-6 py-4 md:py-8 max-w-2xl">
        <SurveyTaker
          surveyId={survey.id}
          title={survey.title}
          description={survey.description}
          isAnonymous={survey.isAnonymous}
          questions={survey.questions.map(q => ({
            id:       q.id,
            type:     q.type,
            text:     q.text,
            required: q.required,
            options:  q.options as string[] | null,
            order:    q.order,
          }))}
        />
      </div>
    </div>
  )
}
