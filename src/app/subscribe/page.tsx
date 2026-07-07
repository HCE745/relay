import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { SubscriptionSelector } from "./subscription-selector"

export const dynamic = "force-dynamic"

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { highlight } = await searchParams

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      name:              true,
      plan:              true,
      employeeLimit:     true,
      locationLimit:     true,
      companySize:       true,
      numberOfLocations: true,
      intelligenceModules:      true,
      intelligenceSuiteEnabled: true,
      discountPercent:   true,
      discountExpiresAt: true,
      discountLabel:     true,
    },
  })

  if (!org) redirect("/dashboard")

  // Pre-fill employee / location count from onboarding data
  const employeeCount = org.employeeLimit
    ?? (org.companySize ? parseInt(org.companySize, 10) || 10 : 10)
  const locationCount = org.locationLimit
    ?? (org.numberOfLocations ? parseInt(org.numberOfLocations, 10) || 1 : 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <SubscriptionSelector
        orgName={org.name}
        initialPlan={(["essentials", "professional", "professional_plus"] as const).includes(org.plan as "essentials" | "professional" | "professional_plus") ? org.plan as "essentials" | "professional" | "professional_plus" : "essentials"}
        initialEmployeeCount={employeeCount}
        initialLocationCount={locationCount}
        initialModules={org.intelligenceModules ?? []}
        initialSuite={org.intelligenceSuiteEnabled ?? false}
        discountPercent={org.discountPercent ?? null}
        discountExpiresAt={org.discountExpiresAt?.toISOString() ?? null}
        discountLabel={org.discountLabel ?? null}
        highlightSection={highlight ?? null}
      />
    </div>
  )
}
