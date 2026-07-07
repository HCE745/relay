import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { EmployeeTypesClient } from "./employee-types-client"
import { EMPLOYEE_TYPE_PRESETS } from "@/lib/employee-type-presets"

export const dynamic = "force-dynamic"

export default async function EmployeeTypesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/dashboard")

  const types = await prisma.employeeType.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ isPreset: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  })

  return (
    <div>
      <Header title="Employee Types" />
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Employee Types</h1>
        <p className="text-sm text-gray-500 mt-0.5">Define roles and their default permissions</p>
      </div>
      <div className="px-3 md:px-6 py-2 md:py-6 max-w-4xl">
        <EmployeeTypesClient
          initialTypes={JSON.parse(JSON.stringify(types))}
          presets={EMPLOYEE_TYPE_PRESETS}
        />
      </div>
    </div>
  )
}
