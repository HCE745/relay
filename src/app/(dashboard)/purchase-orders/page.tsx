import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-blue-100 text-blue-700",
  PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-400",
  CANCELLED: "bg-red-100 text-red-400",
}

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
}

export default async function PurchaseOrdersPage() {
  const { tenantId, entityId } = await getEntityContext()

  const pos = await prisma.purchaseOrder.findMany({
    where: { tenantId, entityId },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 200,
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <Link href="/purchase-orders/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> New PO
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>Expected</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No purchase orders yet</td></tr>
            )}
            {pos.map((po) => (
              <tr key={po.id}>
                <td>
                  <Link href={`/purchase-orders/${po.id}`} className="text-blue-600 hover:underline font-medium">
                    {po.poNumber ?? po.id.slice(0, 8)}
                  </Link>
                </td>
                <td>{po.vendor.name}</td>
                <td>{po.date.toISOString().slice(0, 10)}</td>
                <td>{po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : "—"}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] ?? "bg-gray-100"}`}>
                    {po.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="text-right font-mono">{fmt(po.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
