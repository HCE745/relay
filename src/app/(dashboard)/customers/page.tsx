import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, Users } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

export default async function CustomersPage() {
  const { tenantId, entityId } = await getEntityContext()
  const customers = await prisma.customer.findMany({
    where: { tenantId, entityId, isActive: true },
    include: { _count: { select: { invoices: true } } },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/customers/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> New Customer
        </Link>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Payment Terms</th>
              <th className="num">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Add the businesses or individuals you invoice. Customers are selected when creating invoices to record accounts receivable."
                actions={[{ label: "New Customer", href: "/customers/new" }]}
              />
            ) : customers.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-slate-500">{c.email ?? "—"}</td>
                <td className="text-slate-500">{c.phone ?? "—"}</td>
                <td className="text-slate-600">{c.paymentTerms}</td>
                <td className="num text-slate-600">{c._count.invoices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
