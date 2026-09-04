import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Plus, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { USER_ROLE } from "@/lib/constants"
import { InviteUserDialog } from "@/components/team/invite-user-dialog"
import { TeamActions } from "@/components/team/team-actions"
import { OrgChart } from "@/components/team/org-chart"
import { getSubordinateIds } from "@/lib/hierarchy"
import { TeamViewToggle } from "@/components/team/team-view-toggle"

export const dynamic = "force-dynamic"

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { view } = await searchParams
  const showOrgChart = view === "chart"

  const orgId = session.organizationId
  const isAdminLevel = ["ADMIN", "HR"].includes(session.role)

  const [users, departments, locations, currentUser, employeeTypes] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        department: { select: { name: true } },
        location: { select: { name: true } },
        manager: { select: { id: true, name: true } },
        assignedLocations: { include: { location: { select: { id: true, name: true } } } },
        _count: { select: { assignedIssues: true, reportedIssues: true } },
      },
    }),
    prisma.department.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { canInvite: true, canChangeEmail: true, departmentId: true },
    }),
    prisma.employeeType.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, baseRole: true },
    }),
  ])

  const canInviteUsers = isAdminLevel || (currentUser?.canInvite ?? false)

  const hierarchyUsers = users.map((u) => ({ id: u.id, managerId: u.managerId }))
  const subordinateIds = isAdminLevel
    ? new Set(users.map((u) => u.id))
    : new Set(getSubordinateIds(session.userId, hierarchyUsers))

  const hasManageRights = isAdminLevel || subordinateIds.size > 0

  const roleColor: Record<string, string> = {
    ADMIN:      "bg-purple-100 text-purple-800 border-purple-200",
    MANAGER:    "bg-blue-100 text-blue-800 border-blue-200",
    SUPERVISOR: "bg-indigo-100 text-indigo-800 border-indigo-200",
    EMPLOYEE:   "bg-gray-100 text-gray-700 border-gray-200",
    VENDOR:     "bg-orange-100 text-orange-800 border-orange-200",
    HR:         "bg-pink-100 text-pink-800 border-pink-200",
  }

  const orgUsersForActions = users.map((u) => ({ id: u.id, name: u.name, role: u.role, email: u.email, department: u.department?.name ?? undefined, location: u.location?.name ?? undefined }))
  const orgLocationsForActions = locations.map(l => ({ id: l.id, name: l.name }))

  return (
    <div>
      <Header
        title="Team"
        actions={
          <>
            {["ADMIN", "HR", "MANAGER"].includes(session.role) && (
              <a href="/api/export/users" download className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </a>
            )}
            {canInviteUsers && (
              <InviteUserDialog
                departments={departments}
                locations={locations}
                users={orgUsersForActions}
                employeeTypes={employeeTypes}
                sessionUser={{
                  role: session.role,
                  canInvite: currentUser?.canInvite ?? false,
                  departmentId: currentUser?.departmentId ?? null,
                }}
              >
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  Invite Member
                </button>
              </InviteUserDialog>
            )}
          </>
        }
      />

      {/* Mobile page title + invite button */}
      <div className="md:hidden flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Team</h1>
        {canInviteUsers && (
          <InviteUserDialog
            departments={departments}
            locations={locations}
            users={orgUsersForActions}
            sessionUser={{
              role: session.role,
              canInvite: currentUser?.canInvite ?? false,
              departmentId: currentUser?.departmentId ?? null,
            }}
          >
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" />
              Invite
            </button>
          </InviteUserDialog>
        )}
      </div>

      {!hasManageRights && !canInviteUsers && (
        <div className="mx-4 md:mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg">
          User management is restricted to Admin and HR roles.
        </div>
      )}

      <div className="px-3 md:px-6 py-2 md:py-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <p className="text-sm text-gray-500">{users.length} member{users.length !== 1 ? "s" : ""}</p>
          <TeamViewToggle currentView={view ?? "list"} />
        </div>

        {showOrgChart ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 md:px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Organization Chart</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Click arrows to expand or collapse branches. Set reporting relationships via Manage → Set Manager.
              </p>
            </div>
            <OrgChart
              users={users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                isActive: u.isActive,
                managerId: u.managerId,
                department: u.department,
              }))}
              sessionUserId={session.userId}
            />
          </div>
        ) : (
          <>
            {/* ── Mobile card list ─────────────────────────────────── */}
            <div className="md:hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {users.map((user) => {
                const canAct = subordinateIds.has(user.id)
                return (
                  <div key={user.id} className="p-4">
                    {/* Top row: avatar + name + role badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900 truncate">
                              {user.name}
                            </span>
                            {user.id === session.userId && (
                              <span className="text-xs text-blue-500 font-normal shrink-0">(you)</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      {/* Actions + status pill */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            user.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                        {hasManageRights && canAct && (
                          <TeamActions
                            userId={user.id}
                            userName={user.name}
                            userRole={user.role}
                            sessionRole={session.role}
                            canInvite={user.canInvite}
                            canChangeEmail={user.canChangeEmail}
                            currentManagerId={user.managerId}
                            orgUsers={orgUsersForActions}
                            orgLocations={orgLocationsForActions}
                            assignedLocationIds={user.assignedLocations.map(ul => ul.locationId)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Detail chips */}
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      <Badge className={`text-xs ${roleColor[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {USER_ROLE[user.role as keyof typeof USER_ROLE] ?? user.role}
                      </Badge>
                      {user.department && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {user.department.name}
                        </span>
                      )}
                      {user.manager && (
                        <span className="text-xs text-gray-400">
                          Reports to {user.manager.name}
                        </span>
                      )}
                    </div>

                    {/* Issue counts */}
                    {(user._count.assignedIssues > 0 || user._count.reportedIssues > 0) && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        {user._count.assignedIssues} assigned · {user._count.reportedIssues} reported
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table ────────────────────────────────────── */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Member</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Department</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Reports To</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Issues</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    {hasManageRights && (
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => {
                    const canAct = subordinateIds.has(user.id)
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm font-medium">{user.name.charAt(0)}</span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                                {user.name}
                                {user.id === session.userId && (
                                  <span className="text-xs text-blue-500 font-normal">(you)</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={roleColor[user.role] ?? "bg-gray-100 text-gray-700"}>
                            {USER_ROLE[user.role as keyof typeof USER_ROLE] ?? user.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{user.department?.name ?? "—"}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{user.manager?.name ?? "—"}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {user._count.assignedIssues} assigned · {user._count.reportedIssues} reported
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        {hasManageRights && (
                          <td className="px-4 py-4">
                            {canAct ? (
                              <TeamActions
                                userId={user.id}
                                userName={user.name}
                                userRole={user.role}
                                sessionRole={session.role}
                                canInvite={user.canInvite}
                                canChangeEmail={user.canChangeEmail}
                                currentManagerId={user.managerId}
                                orgUsers={orgUsersForActions}
                                orgLocations={orgLocationsForActions}
                                assignedLocationIds={user.assignedLocations.map(ul => ul.locationId)}
                              />
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
