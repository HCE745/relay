import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
import { Plus, Building2 } from "lucide-react"
import { DepartmentDialog } from "@/components/departments/department-dialog"

export default async function DepartmentsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId

  const [departments, locations] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        location: { select: { name: true } },
        _count: { select: { users: true, issues: true, assets: true } },
      },
    }),
    prisma.location.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
  ])

  return (
    <div>
      <Header
        title="Departments"
        actions={
          <span className={session.isDemo ? "hidden sm:contents" : undefined}>
            <DepartmentDialog locations={locations}>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Add Department
              </button>
            </DepartmentDialog>
          </span>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-gray-200">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No departments added yet</p>
            </div>
          ) : (
            departments.map((dept) => (
              <div key={dept.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    {dept.location && <p className="text-xs text-gray-400 mt-0.5">📍 {dept.location.name}</p>}
                  </div>
                  <DepartmentDialog locations={locations} initialData={dept}>
                    <button className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded border border-gray-200 hover:border-blue-300">Edit</button>
                  </DepartmentDialog>
                </div>
                <div className="flex gap-4 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{dept._count.users}</div>
                    <div className="text-xs text-gray-400">Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{dept._count.assets}</div>
                    <div className="text-xs text-gray-400">Assets</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{dept._count.issues}</div>
                    <div className="text-xs text-gray-400">Issues</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
