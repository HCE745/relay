import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { InvoiceActions } from "@/components/invoices/InvoiceActions"

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
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
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
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/invoices" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoiceNumber}</h1>
          {statusBadge(invoice.status)}
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Customer</p>
            <p className="font-semibold">{invoice.customer.name}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Invoice Date</p>
            <p className="font-medium">{invoice.date.toISOString().slice(0, 10)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Due Date</p>
            <p className="font-medium">{invoice.dueDate.toISOString().slice(0, 10)}</p>
          </div>
          {invoice.memo && (
            <div className="col-span-3">
              <p className="text-gray-500 mb-1">Memo</p>
              <p className="font-medium">{invoice.memo}</p>
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Account</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description ?? "—"}</td>
                <td className="text-gray-500 text-xs">{line.account?.code} {line.account?.name ?? "—"}</td>
                <td className="text-right font-mono">{line.quantity}</td>
                <td className="text-right font-mono">{fmt(line.unitPrice)}</td>
                <td className="text-right font-mono">{fmt(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-col items-end gap-1.5 text-sm">
          <div className="flex gap-16">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-mono w-28 text-right">{fmt(invoice.subtotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex gap-16">
              <span className="text-gray-500">Tax</span>
              <span className="font-mono w-28 text-right">{fmt(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex gap-16 font-semibold text-base border-t border-gray-200 pt-2 mt-1">
            <span>Total</span>
            <span className="font-mono w-28 text-right">{fmt(invoice.total)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex gap-16 text-green-700">
              <span>Paid</span>
              <span className="font-mono w-28 text-right">({fmt(invoice.amountPaid)})</span>
            </div>
          )}
          {invoice.amountDue > 0 && (
            <div className="flex gap-16 font-semibold text-red-600">
              <span>Balance Due</span>
              <span className="font-mono w-28 text-right">{fmt(invoice.amountDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      {invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payments</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Memo</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.date.toISOString().slice(0, 10)}</td>
                  <td className="text-gray-500">{p.memo ?? "—"}</td>
                  <td className="text-right font-mono text-green-700">{fmt(p.amount)}</td>
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
