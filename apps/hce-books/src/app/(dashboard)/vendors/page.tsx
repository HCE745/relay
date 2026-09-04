import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, Building2 } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

export default async function VendorsPage() {
  const { tenantId, entityId } = await getEntityContext()
  const vendors = await prisma.vendor.findMany({
    where: { tenantId, entityId, isActive: true },
    include: { _count: { select: { bills: true } } },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-subtitle">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/vendors/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> New Vendor
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
              <th>Tax ID</th>
              <th className="num">Bills</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No vendors yet"
                description="Add the businesses you pay — rent, software, contractors, utilities. Vendors are attached to bills for accurate AP tracking."
                actions={[{ label: "New Vendor", href: "/vendors/new" }]}
              />
            ) : vendors.map((v) => (
              <tr key={v.id}>
                <td className="font-medium">{v.name}</td>
                <td className="text-slate-500">{v.email ?? "—"}</td>
                <td className="text-slate-500">{v.phone ?? "—"}</td>
                <td className="text-slate-600">{v.paymentTerms}</td>
                <td className="fin text-slate-400 text-xs">{v.taxId ?? "—"}</td>
                <td className="num text-slate-600">{v._count.bills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
