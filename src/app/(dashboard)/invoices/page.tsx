import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, FileText } from "lucide-react"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

const STATUS_TABS = ["", "DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE"] as const

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { tenantId, entityId } = await getEntityContext()
  const { status } = await searchParams

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId, entityId,
      ...(status ? { status: status as never } : {}),
    },
    include: { customer: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 100,
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{invoices.length > 0 ? `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}` : "Bill your customers and track what's owed"}</p>
        </div>
        <Link href="/invoices/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> New Invoice
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="filter-tabs">
        {STATUS_TABS.map((s) => (
          <Link
            key={s}
            href={s ? `/invoices?status=${s}` : "/invoices"}
            className={`filter-tab ${(status ?? "") === s ? "active" : ""}`}
          >
            {s || "All"}
          </Link>
        ))}
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Due</th>
              <th className="num">Total</th>
              <th className="num">Amount Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={status ? `No ${status.toLowerCase()} invoices` : "No invoices yet"}
                description={status ? "Try a different status filter above." : "Create your first invoice to bill a customer and record accounts receivable."}
                actions={status ? [{ label: "View all", href: "/invoices", secondary: true }] : [{ label: "New Invoice", href: "/invoices/new" }]}
              />
            ) : invoices.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-700 hover:text-blue-800">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td>{inv.customer.name}</td>
                <td className="fin text-slate-500">{inv.date.toISOString().slice(0, 10)}</td>
                <td className="fin text-slate-500">{inv.dueDate.toISOString().slice(0, 10)}</td>
                <td className="num fin">{fmt(inv.total)}</td>
                <td className={`num fin ${inv.amountDue > 0 ? "font-medium" : "text-slate-400"}`}>
                  {inv.amountDue > 0 ? fmt(inv.amountDue) : "—"}
                </td>
                <td><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
