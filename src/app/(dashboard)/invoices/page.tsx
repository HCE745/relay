import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    SENT: "bg-blue-100 text-blue-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    PAID: "bg-green-100 text-green-700",
    OVERDUE: "bg-red-100 text-red-700",
    VOID: "bg-gray-100 text-gray-400",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { tenantId, entityId } = await getEntityContext()
  const { status } = await searchParams

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId, entityId,
      ...(status ? { status: status as never } : {}),
    },
    include: { customer: true },
    orderBy: { date: "desc" },
    take: 100,
  })

  function fmt(cents: number) {
    return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <Link href="/invoices/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {["", "DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE"].map((s) => (
          <Link
            key={s}
            href={s ? `/invoices?status=${s}` : "/invoices"}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              (status ?? "") === s
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {s || "All"}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th><th>Customer</th><th>Date</th><th>Due</th>
              <th className="text-right">Total</th><th className="text-right">Due</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No invoices</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline font-medium">{inv.invoiceNumber}</Link></td>
                <td>{inv.customer.name}</td>
                <td>{inv.date.toISOString().slice(0, 10)}</td>
                <td>{inv.dueDate.toISOString().slice(0, 10)}</td>
                <td className="text-right font-mono">{fmt(inv.total)}</td>
                <td className="text-right font-mono">{fmt(inv.amountDue)}</td>
                <td>{statusBadge(inv.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
