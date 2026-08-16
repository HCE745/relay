import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { SetupWizard } from "./setup-wizard"

export const dynamic = "force-dynamic"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; plan?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.onboardingCompleted !== false) redirect("/dashboard")

  const { industry: industryRaw, plan } = await searchParams

  // Normalize URL slugs (e.g. from tour CTA) to full industry labels used in the wizard.
  const INDUSTRY_SLUG_MAP: Record<string, string> = {
    car_wash:            "Car Wash",
    property_management: "Property Management",
    manufacturing:       "Manufacturing",
    warehousing:         "Warehousing",
    hospitality:         "Hospitality",
    healthcare:          "Healthcare",
    retail:              "Retail",
    construction:        "Construction",
  }
  const industry = industryRaw
    ? (INDUSTRY_SLUG_MAP[industryRaw.toLowerCase().replace(/-/g, "_")] ?? industryRaw)
    : undefined

  return (
    <div className="min-h-screen bg-gray-50">
      <SetupWizard
        orgName={session.name}
        userId={session.userId}
        initialIndustry={industry}
        initialPlan={plan}
      />
    </div>
  )
}
