import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { AnalyticsClient } from "./analytics-client"
import { PlanGateContent } from "@/components/layout/plan-gate"
import { isProfessional } from "@/lib/pricing"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)) redirect("/dashboard")

  if (!isProfessional(session.plan ?? "essentials")) {
    return (
      <div>
        <Header title="Analytics" />
        <PlanGateContent feature="analytics" />
      </div>
    )
  }

  const { organizationId, role, userId } = session

  // Fetch scope options for the scope selector
  const [locations, departments, currentUser] = await Promise.all([
    role === "ADMIN"
      ? prisma.location.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    role !== "EMPLOYEE"
      ? prisma.department.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    }),
  ])

  // For supervisors: default scope is their own dept
  const defaultScope =
    role === "SUPERVISOR" && currentUser?.departmentId
      ? `dept:${currentUser.departmentId}`
      : "org"

  const orgFlags = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { cross_location_analytics_enabled: true },
  })

  return (
    <div>
      <Header
        title="Analytics"
        actions={
          orgFlags?.cross_location_analytics_enabled ? (
            <Link
              href="/analytics/cross-location"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              Cross-Location Comparison →
            </Link>
          ) : undefined
        }
      />
      <div className="p-6" data-tour="analytics-charts">
        <AnalyticsClient
          role={role}
          defaultScope={defaultScope}
          locations={locations}
          departments={departments}
        />
      </div>
    </div>
  )
}
