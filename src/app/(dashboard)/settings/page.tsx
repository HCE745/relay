import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Users, Calendar, Building2, Tag, LayoutGrid, ChevronRight } from "lucide-react"
import { canManageUsers } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const { session, tenantId, entityId, selectedEntity } = await getEntityContext()

  const [users, periods, entities, classes, departments] = await Promise.all([
    prisma.hceUser.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.accountingPeriod.findMany({ where: { tenantId, entityId }, orderBy: { periodStart: "desc" } }),
    prisma.entity.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ where: { tenantId, entityId } }),
    prisma.department.findMany({ where: { tenantId, entityId } }),
  ])

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Entities */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Entities</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Legal Name</th><th>Parent</th><th>Currency</th><th>Type</th></tr></thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.name}</td>
                  <td className="text-gray-500">{e.legalName}</td>
                  <td className="text-gray-400">{entities.find((p) => p.id === e.parentEntityId)?.name ?? "—"}</td>
                  <td>{e.baseCurrency}</td>
                  <td>{e.isConsolidationParent ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Parent</span> : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Subsidiary</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Accounting Periods */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Accounting Periods</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td>{p.periodStart.toISOString().slice(0, 7)} – {p.periodEnd.toISOString().slice(0, 7)}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    {p.status === "OPEN" && (
                      <button className="text-xs text-red-600 hover:text-red-800 font-medium">Close Period</button>
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
            <Users className="w-5 h-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Users & Roles</h2>
          </div>
          {canManageUsers(session.role) && (
            <Link
              href="/settings/users"
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage users
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name ?? "—"}</td>
                  <td className="text-gray-500">{u.email}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === "OWNER" ? "bg-purple-100 text-purple-700" :
                      u.role === "ADMIN" ? "bg-blue-100 text-blue-700" :
                      u.role === "ACCOUNTANT" ? "bg-green-100 text-green-700" :
                      u.role === "BOOKKEEPER" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{u.role}</span>
                  </td>
                  <td>
                    {!u.active && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Deactivated</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Classes & Departments */}
      <div className="grid grid-cols-2 gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Classes</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Active</th></tr></thead>
              <tbody>
                {classes.length === 0 && <tr><td colSpan={2} className="text-center py-4 text-gray-400">No classes</td></tr>}
                {classes.map((c) => (
                  <tr key={c.id}><td>{c.name}</td><td>{c.isActive ? "Yes" : "No"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Departments</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Active</th></tr></thead>
              <tbody>
                {departments.length === 0 && <tr><td colSpan={2} className="text-center py-4 text-gray-400">No departments</td></tr>}
                {departments.map((d) => (
                  <tr key={d.id}><td>{d.name}</td><td>{d.isActive ? "Yes" : "No"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
