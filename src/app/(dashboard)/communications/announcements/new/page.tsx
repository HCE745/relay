import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { AnnouncementForm } from "@/components/communications/announcement-form"

export const dynamic = "force-dynamic"

export default async function NewAnnouncementPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!canCreate) redirect("/communications/announcements")

  const orgId = session.organizationId

  const [locationsRaw, departmentsRaw, teamLeadsRaw, usersRaw] = await Promise.all([
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
        <span>/</span>
        <Link href="/communications/announcements" className="hover:text-gray-700 dark:hover:text-gray-300">Announcements</Link>
        <span>/</span>
        <span>New</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Announcement</h1>
      <AnnouncementForm
        locations={locations}
        departments={departments}
        teamLeads={teamLeads}
        users={users}
      />
    </div>
  )
}
