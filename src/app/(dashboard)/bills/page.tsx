import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    ENTERED: "bg-blue-100 text-blue-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    PAID: "bg-green-100 text-green-700",
    VOID: "bg-gray-100 text-gray-400",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  )
}

export default async function BillsPage() {
  const { tenantId, entityId } = await getEntityContext()

  const bills = await prisma.bill.findMany({
    where: { tenantId, entityId },
    include: { vendor: true },
    orderBy: { date: "desc" },
    take: 100,
  })

  function fmt(cents: number) {
    return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <Link href="/bills/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Enter Bill
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bill #</th><th>Vendor</th><th>Date</th><th>Due</th>
              <th className="text-right">Total</th><th className="text-right">Owed</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No bills</td></tr>
            )}
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td className="font-medium">{bill.billNumber ?? bill.id.slice(0, 8)}</td>
                <td>{bill.vendor.name}</td>
                <td>{bill.date.toISOString().slice(0, 10)}</td>
                <td>{bill.dueDate.toISOString().slice(0, 10)}</td>
                <td className="text-right font-mono">{fmt(bill.total)}</td>
                <td className="text-right font-mono">{fmt(bill.amountDue)}</td>
                <td>{statusBadge(bill.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
