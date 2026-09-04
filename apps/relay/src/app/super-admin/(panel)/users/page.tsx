import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { AddSuperAdminForm } from "./add-form"
import { SuperAdminRowActions } from "./row-actions"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function SuperAdminUsersPage() {
  const session = await getSession()
  const admins  = await prisma.superAdmin.findMany({ orderBy: { createdAt: "asc" } })

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Super Admin Users</h1>
        <p className="text-gray-400 text-sm mt-1">
          Team members with access to this control panel
        </p>
      </div>

      {/* Add form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Add Team Member</h2>
        <AddSuperAdminForm />
      </div>

      {/* Existing admins */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {["Name", "Email", "Created", "Status", ""].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {admins.map((sa) => (
              <tr key={sa.id} className="hover:bg-gray-800/30">
                <td className="px-5 py-3.5">
                  <span className="text-white text-sm font-medium">{sa.name}</span>
                  {sa.id === session?.superAdminId && (
                    <span className="ml-2 text-xs text-indigo-400">(you)</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-sm">{sa.email}</td>
                <td className="px-5 py-3.5 text-gray-400 text-sm">
                  {format(new Date(sa.createdAt), "MMM d, yyyy")}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sa.isActive ? "bg-green-900/50 text-green-300" : "bg-gray-800 text-gray-500"}`}>
                    {sa.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <SuperAdminRowActions
                    id={sa.id}
                    isActive={sa.isActive}
                    isSelf={sa.id === session?.superAdminId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
