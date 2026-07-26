import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Users, Calendar, Building2, Tag, LayoutGrid, ChevronRight } from "lucide-react"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { canManageUsers } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const { session, tenantId, entityId } = await getEntityContext()

  const [users, periods, entities, classes, departments] = await Promise.all([
    prisma.hceUser.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.accountingPeriod.findMany({ where: { tenantId, entityId }, orderBy: { periodStart: "desc" } }),
    prisma.entity.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ where: { tenantId, entityId } }),
    prisma.department.findMany({ where: { tenantId, entityId } }),
  ])

  const ROLE_BADGE: Record<string, string> = {
    OWNER: "badge-purple",
    ADMIN: "badge-blue",
    ACCOUNTANT: "badge-green",
    BOOKKEEPER: "badge-amber",
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Entities */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>Entities</h2>
        </div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Legal Name</th><th>Parent</th><th>Currency</th><th>Type</th></tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.name}</td>
                  <td className="text-slate-500">{e.legalName}</td>
                  <td className="text-slate-400">{entities.find((p) => p.id === e.parentEntityId)?.name ?? "—"}</td>
                  <td className="fin text-slate-500">{e.baseCurrency}</td>
                  <td>
                    <span className={`badge ${e.isConsolidationParent ? "badge-purple" : "badge-gray"}`}>
                      {e.isConsolidationParent ? "Parent" : "Subsidiary"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Accounting Periods */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>Accounting Periods</h2>
        </div>
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {periods.length === 0 && (
                <tr><td colSpan={3} className="text-center py-6" style={{ color: "var(--text-faint)" }}>No accounting periods configured</td></tr>
              )}
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="fin text-slate-600">
                    {p.periodStart.toISOString().slice(0, 7)} – {p.periodEnd.toISOString().slice(0, 7)}
                  </td>
                  <td>
                    <StatusBadge status={p.status === "OPEN" ? "OPEN" : "CLOSED"} />
                  </td>
                  <td>
                    {p.status === "OPEN" && (
                      <button className="text-xs font-medium text-red-600 hover:text-red-700">Close Period</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Users */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>Users &amp; Roles</h2>
          </div>
          {canManageUsers(session.role) && (
            <Link href="/settings/users" className="flex items-center gap-1 text-sm font-medium" style={{ color: "var(--accent)" }}>
              Manage users <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name ?? "—"}</td>
                  <td className="text-slate-500">{u.email}</td>
                  <td>
                    <span className={`badge ${ROLE_BADGE[u.role] ?? "badge-gray"}`}>{u.role}</span>
                  </td>
                  <td>
                    {!u.active && <span className="badge badge-red">Deactivated</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Classes & Departments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>Classes</h2>
          </div>
          <div className="card">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Active</th></tr></thead>
              <tbody>
                {classes.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-4" style={{ color: "var(--text-faint)" }}>No classes</td></tr>
                )}
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td><StatusBadge status={c.isActive ? "ACTIVE" : "VOID"} label={c.isActive ? "Yes" : "No"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>Departments</h2>
          </div>
          <div className="card">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Active</th></tr></thead>
              <tbody>
                {departments.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-4" style={{ color: "var(--text-faint)" }}>No departments</td></tr>
                )}
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td><StatusBadge status={d.isActive ? "ACTIVE" : "VOID"} label={d.isActive ? "Yes" : "No"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
