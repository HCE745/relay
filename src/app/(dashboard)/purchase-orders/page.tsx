import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, Package } from "lucide-react"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default async function PurchaseOrdersPage() {
  const { tenantId, entityId } = await getEntityContext()

  const pos = await prisma.purchaseOrder.findMany({
    where: { tenantId, entityId },
    include: { vendor: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 200,
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">{pos.length} order{pos.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/purchase-orders/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> New PO
        </Link>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>Expected</th>
              <th>Status</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No purchase orders yet"
                description="Create a PO to authorize a vendor purchase before the bill arrives. Once received, convert to a bill with one click."
                actions={[{ label: "New PO", href: "/purchase-orders/new" }]}
              />
            ) : pos.map((po) => (
              <tr key={po.id}>
                <td>
                  <Link href={`/purchase-orders/${po.id}`} className="font-medium text-blue-700 hover:text-blue-800">
                    {po.poNumber ?? po.id.slice(0, 8)}
                  </Link>
                </td>
                <td>{po.vendor.name}</td>
                <td className="fin text-slate-500">{po.date.toISOString().slice(0, 10)}</td>
                <td className="fin text-slate-500">{po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : "—"}</td>
                <td><StatusBadge status={po.status} label={po.status.replace(/_/g, " ")} /></td>
                <td className="num fin">{fmt(po.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
