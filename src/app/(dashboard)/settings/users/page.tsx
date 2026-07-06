import { redirect } from "next/navigation"
import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { canManageUsers } from "@/lib/permissions"
import { UsersPage } from "@/components/settings/UsersPage"

export const dynamic = "force-dynamic"

export default async function SettingsUsersPage() {
  const { session, tenantId } = await getEntityContext()

  if (!canManageUsers(session.role)) {
    redirect("/settings")
  }

  const [users, entities] = await Promise.all([
    prisma.hceUser.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: { entityAccess: { include: { entity: { select: { id: true, name: true } } } } },
    }),
    prisma.entity.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ])

  const usersData = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name ?? "",
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    entityAccess: u.entityAccess.map((a) => ({ entityId: a.entityId, entityName: a.entity.name })),
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users & Access</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage who can access this tenant and what they can do
        </p>
      </div>
      <UsersPage users={usersData} entities={entities} currentUserId={session.userId} />
    </div>
  )
}
