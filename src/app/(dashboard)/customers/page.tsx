import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function CustomersPage() {
  const { tenantId, entityId } = await getEntityContext()
  const customers = await prisma.customer.findMany({
    where: { tenantId, entityId, isActive: true },
    include: { _count: { select: { invoices: true } } },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <Link href="/customers/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Customer
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Terms</th><th>Invoices</th></tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No customers yet</td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-gray-500">{c.email ?? "—"}</td>
                <td className="text-gray-500">{c.phone ?? "—"}</td>
                <td>{c.paymentTerms}</td>
                <td>{c._count.invoices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
