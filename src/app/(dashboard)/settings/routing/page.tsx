import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { RoutingRulesManager } from "@/components/settings/routing-rules-manager"

export const dynamic = "force-dynamic"

export default async function RoutingSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN" && session.role !== "MANAGER") redirect("/dashboard")

  const [rules, locations, departments, users] = await Promise.all([
    prisma.routingRule.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        condLocation: { select: { id: true, name: true } },
        condDept: { select: { id: true, name: true } },
        assignToUser: { select: { id: true, name: true } },
      },
    }),
    prisma.location.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, email: true, department: { select: { name: true } }, location: { select: { name: true } } },
    }),
  ])

  return (
    <div>
      <Header title="Routing Rules" />
      <div className="p-6 max-w-3xl">
        {/* How it works banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">How auto-routing works</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>When an issue is submitted without a manually chosen assignee, Relay evaluates all active rules.</li>
            <li>Each rule can filter by category, priority, location, department, and asset type. Leaving a condition blank means it matches anything.</li>
            <li>The rule with the most matching conditions wins (most specific first). Ties are broken by newest rule.</li>
            <li>The winning rule assigns the issue to a specific user or to the nearest user with a given role.</li>
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <RoutingRulesManager
            rules={rules}
            locations={locations}
            departments={departments}
            users={users.map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email, department: u.department?.name ?? undefined, location: u.location?.name ?? undefined }))}
          />
        </div>
      </div>
    </div>
  )
}
