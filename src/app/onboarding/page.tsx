import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SetupWizard } from "./setup-wizard"

export const dynamic = "force-dynamic"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.onboardingCompleted !== false) redirect("/dashboard")

  const { industry } = await searchParams

  return (
    <div className="min-h-screen bg-gray-50">
      <SetupWizard
        orgName={session.name}
        userId={session.userId}
        initialIndustry={industry}
      />
    </div>
  )
}
