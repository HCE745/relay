import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { EmergencyPageClient } from "@/components/communications/emergency-page-client"
import { UpgradePrompt } from "@/components/ui/feature-gate"
import { getOrgWCFlags } from "@/lib/workforce-comms"

export const dynamic = "force-dynamic"

export default async function EmergencyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const sp = await searchParams
  const showCreate = sp.create === "1" && ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  const orgId  = session.organizationId
  const wcFlags = await getOrgWCFlags(orgId)

  const [broadcasts, locationsRaw, departmentsRaw, teamLeadsRaw, usersRaw] = await Promise.all([
    prisma.emergencyBroadcast.findMany({
      where: { orgId },
      include: {
        createdBy:  { select: { id: true, name: true, role: true } },
        resolvedBy: { select: { id: true, name: true } },
        acknowledgments: {
          where:  { userId: session.userId },
          select: { userId: true, acknowledgedAt: true },
        },
        _count: { select: { acknowledgments: true } },
      },
      orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.location.findMany({
      where:   { organizationId: orgId, isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where:   { organizationId: orgId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where:   { organizationId: orgId, role: { in: ["MANAGER", "SUPERVISOR"] as never }, isActive: true },
      select:  { id: true, name: true, role: true, department: { select: { locationId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where:   { organizationId: orgId, isActive: true },
      select:  { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    }),
  ])

  const locations   = locationsRaw
  const departments = departmentsRaw
  const teamLeads   = teamLeadsRaw.map(u => ({
    id:         u.id,
    name:       u.name,
    locationId: (u.department as { locationId: string | null } | null)?.locationId ?? null,
  }))
  const users = usersRaw.map(u => ({
    id:    u.id,
    name:  u.name,
    role:  u.role,
    email: u.email ?? undefined,
  }))

  const canCreate  = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  const canResolve = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  const userId     = session.userId
  const hasAccess  = wcFlags?.wc_emergency_broadcasts ?? false

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
        <span>/</span>
        <span>Emergency Broadcasts</span>
      </div>

      {!hasAccess ? (
        <UpgradePrompt feature="Emergency Broadcasts" planRequired="professional" />
      ) : (
      <EmergencyPageClient
        broadcasts={broadcasts as never}
        userId={userId}
        canCreate={canCreate}
        canResolve={canResolve}
        showCreate={showCreate}
        locations={locations}
        departments={departments}
        teamLeads={teamLeads}
        users={users}
      />
      )}
    </div>
  )
}
