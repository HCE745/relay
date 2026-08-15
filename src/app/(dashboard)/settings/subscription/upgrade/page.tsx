import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { Header } from "@/components/layout/header"
import { UpgradeSelector } from "./upgrade-selector"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function UpgradePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")
  if (!isWashEssentials(session.productLine)) redirect("/settings/subscription")

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: {
      employeeLimit:     true,
      locationLimit:     true,
      companySize:       true,
      numberOfLocations: true,
      discountPercent:   true,
      discountExpiresAt: true,
      discountLabel:     true,
      _count: { select: { locations: true } },
    },
  })
  if (!org) redirect("/dashboard")

  const employeeCount = org.employeeLimit
    ?? (org.companySize ? parseInt(org.companySize, 10) || 10 : 10)
  const locationCount = Math.max(
    org._count.locations,
    org.locationLimit ?? (org.numberOfLocations ? parseInt(org.numberOfLocations, 10) || 1 : 1),
  )

  return (
    <div>
      <Header title="Upgrade to Full Relay" />
      <div className="p-6 max-w-2xl">
        <Link
          href="/settings/subscription"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Subscription
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Upgrade to Full Relay</h1>
          <p className="text-sm text-gray-500 mt-1">
            Choose a Full Relay plan. Your existing locations and data carry over automatically.
          </p>
        </div>

        <UpgradeSelector
          initialEmployeeCount={employeeCount}
          initialLocationCount={locationCount}
          discountPercent={org.discountPercent ?? null}
          discountExpiresAt={org.discountExpiresAt?.toISOString() ?? null}
          discountLabel={org.discountLabel ?? null}
        />
      </div>
    </div>
  )
}
