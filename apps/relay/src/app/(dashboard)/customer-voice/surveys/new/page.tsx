import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { SurveyBuilder } from "./survey-builder"

export const dynamic = "force-dynamic"

export default async function NewCustomerSurveyPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "HR"].includes(session.role)) redirect("/customer-voice/surveys")

  const locations = await prisma.location.findMany({
    where:   { organizationId: session.organizationId },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Customer Survey</h1>
      <SurveyBuilder locations={locations} />
    </div>
  )
}
