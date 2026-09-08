import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SurveyForm } from "./survey-form"

export const dynamic = "force-dynamic"

export default async function PublicSurveyPage({
  params,
}: {
  params: Promise<{ surveyToken: string }>
}) {
  const { surveyToken } = await params

  const survey = await prisma.customerSurvey.findUnique({
    where: { surveyToken },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      isAnonymous: true,
      questions: true,
      organization: { select: { name: true, logo: true } },
      location:     { select: { name: true } },
    },
  })

  if (!survey || survey.status !== "ACTIVE") notFound()

  return (
    <SurveyForm
      surveyToken={surveyToken}
      title={survey.title}
      description={survey.description}
      questions={survey.questions as Array<{ id: string; type: string; text: string; required?: boolean; options?: string[] }>}
      isAnonymous={survey.isAnonymous}
      orgName={survey.organization.name}
      orgLogo={survey.organization.logo}
      locationName={survey.location?.name ?? null}
    />
  )
}
