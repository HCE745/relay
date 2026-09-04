import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, Receipt } from "lucide-react"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default async function BillsPage() {
  const { tenantId, entityId } = await getEntityContext()

  const bills = await prisma.bill.findMany({
    where: { tenantId, entityId },
    include: { vendor: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 100,
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bills</h1>
          <p className="page-subtitle">{bills.length > 0 ? `${bills.length} bill${bills.length !== 1 ? "s" : ""}` : "Track what you owe vendors"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bills/new" className="btn-primary">
            <Plus className="w-3.5 h-3.5" /> Enter Bill
          </Link>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>Due</th>
              <th className="num">Total</th>
              <th className="num">Balance Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No bills yet"
                description="Enter a vendor bill or scan a receipt to record an expense. Bills post DR Expense / CR Accounts Payable immediately."
                actions={[
                  { label: "Enter Bill", href: "/bills/new" },
                  { label: "View Vendors", href: "/vendors", secondary: true },
                ]}
              />
            ) : bills.map((bill) => (
              <tr key={bill.id}>
                <td>
                  <Link href={`/bills/${bill.id}`} className="font-medium text-blue-700 hover:text-blue-800">
                    {bill.billNumber ?? bill.id.slice(0, 8)}
                  </Link>
                </td>
                <td>{bill.vendor.name}</td>
                <td className="fin text-slate-500">{bill.date.toISOString().slice(0, 10)}</td>
                <td className="fin text-slate-500">{bill.dueDate.toISOString().slice(0, 10)}</td>
                <td className="num fin">{fmt(bill.total)}</td>
                <td className={`num fin ${bill.amountDue > 0 ? "text-red-600 font-medium" : "text-slate-400"}`}>
                  {bill.amountDue > 0 ? fmt(bill.amountDue) : "—"}
                </td>
                <td><StatusBadge status={bill.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
