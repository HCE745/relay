import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { Header } from "@/components/layout/header"
import { SurveyBuilder } from "@/components/surveys/survey-builder"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function NewSurveyPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  if (session.role !== "ADMIN" && session.role !== "HR") redirect("/surveys")

  return (
    <div>
      <Header title="New Survey" />
      <div className="md:hidden px-4 pt-4 pb-2">
        <Link href="/surveys" className="text-sm text-blue-600 hover:underline">← Surveys</Link>
      </div>
      <div className="px-3 md:px-6 py-4 md:py-8 max-w-2xl">
        <p className="text-sm text-gray-500 mb-6">
          Build your survey below. Add questions, choose types, then publish when ready — or save as a draft to finish later.
        </p>
        <SurveyBuilder />
      </div>
    </div>
  )
}
