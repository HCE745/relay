import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { InvoiceActions } from "@/components/invoices/InvoiceActions"
import { StatusBadge } from "@/components/ui/StatusBadge"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, entityId } = await getEntityContext()

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: { include: { account: true }, orderBy: { id: "asc" } },
      payments: { orderBy: { date: "asc" } },
    },
  })

  if (!invoice || invoice.tenantId !== tenantId || invoice.entityId !== entityId) {
    notFound()
  }

  return (
    <div className="p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="hover:text-slate-600 transition-colors" style={{ color: "var(--text-faint)" }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="page-title flex-1">Invoice {invoice.invoiceNumber}</h1>
        <StatusBadge status={invoice.status} />
      </div>

      {/* Meta */}
      <div className="card p-6">
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Customer</p>
            <p className="font-semibold" style={{ color: "var(--text-base)" }}>{invoice.customer.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Invoice Date</p>
            <p className="fin font-medium">{invoice.date.toISOString().slice(0, 10)}</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Due Date</p>
            <p className="fin font-medium">{invoice.dueDate.toISOString().slice(0, 10)}</p>
          </div>
          {invoice.memo && (
            <div className="col-span-3">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Memo</p>
              <p className="font-medium">{invoice.memo}</p>
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-title">Line Items</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Account</th>
              <th className="num">Qty</th>
              <th className="num">Unit Price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description ?? "—"}</td>
                <td className="text-slate-400 text-xs">{line.account?.code} {line.account?.name ?? "—"}</td>
                <td className="num fin text-slate-500">{line.quantity}</td>
                <td className="num fin">{fmt(line.unitPrice)}</td>
                <td className="num fin">{fmt(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 border-t flex flex-col items-end gap-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-16">
            <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
            <span className="fin w-28 text-right">{fmt(invoice.subtotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex gap-16">
              <span style={{ color: "var(--text-muted)" }}>Tax</span>
              <span className="fin w-28 text-right">{fmt(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex gap-16 font-semibold text-base border-t pt-2 mt-1" style={{ borderColor: "var(--border)" }}>
            <span>Total</span>
            <span className="fin w-28 text-right">{fmt(invoice.total)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex gap-16 text-green-700">
              <span>Paid</span>
              <span className="fin w-28 text-right">({fmt(invoice.amountPaid)})</span>
            </div>
          )}
          {invoice.amountDue > 0 && (
            <div className="flex gap-16 font-semibold text-red-600">
              <span>Balance Due</span>
              <span className="fin w-28 text-right">{fmt(invoice.amountDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      {invoice.payments.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">Payments</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Memo</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="fin text-slate-500">{p.date.toISOString().slice(0, 10)}</td>
                  <td className="text-slate-500">{p.memo ?? "—"}</td>
                  <td className="num fin text-green-700">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Client action buttons */}
      <InvoiceActions invoiceId={invoice.id} status={invoice.status} amountDue={invoice.amountDue} />
    </div>
  )
}
