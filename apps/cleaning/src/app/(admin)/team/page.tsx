import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageTeam, assignableRoles } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listUsers } from "@/lib/data/users"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { NewUserButton, UserRowActions } from "@/components/team/team-dialogs"

export const dynamic = "force-dynamic"
const CAP = "workforce.employees"

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  CLEANER: "Cleaner",
}

export default async function TeamPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageTeam(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Team" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const users = await listUsers(session.organizationId)
  const roles = assignableRoles(session.role)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Team" subtitle="Employees & user accounts" />
        <NewUserButton roles={roles} />
      </div>

      {users.length === 0 ? (
        <EmptyState title="No employees yet">Add your first employee to give them app access.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className="px-4 py-3 text-slate-500">{u.employeeProfile?.employeeCode ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <UserRowActions
                      user={{
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        phone: u.phone,
                        role: u.role,
                        isActive: u.isActive,
                        employeeCode: u.employeeProfile?.employeeCode ?? null,
                        payType: u.employeeProfile?.payType ?? null,
                        payRate: u.employeeProfile?.payRate != null ? String(u.employeeProfile.payRate) : null,
                      }}
                      roles={roles}
                      canManage={!(u.id === session.userId)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
