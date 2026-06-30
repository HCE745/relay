import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText, Image as ImageIcon } from "lucide-react"
import { BillPaymentForm } from "@/components/bills/BillPaymentForm"

export const dynamic = "force-dynamic"

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    ENTERED: "bg-blue-100 text-blue-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    PAID: "bg-green-100 text-green-700",
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

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, entityId } = await getEntityContext()

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      vendor: true,
      lines: { include: { account: true }, orderBy: { id: "asc" } },
      payments: { orderBy: { date: "asc" } },
    },
  })

  if (!bill || bill.tenantId !== tenantId || bill.entityId !== entityId) {
    notFound()
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/bills" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            Bill {bill.billNumber ?? bill.id.slice(0, 8)}
          </h1>
          {statusBadge(bill.status)}
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Vendor</p>
            <p className="font-semibold">{bill.vendor.name}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Bill Date</p>
            <p className="font-medium">{bill.date.toISOString().slice(0, 10)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Due Date</p>
            <p className="font-medium">{bill.dueDate.toISOString().slice(0, 10)}</p>
          </div>
          {bill.memo && (
            <div className="col-span-3">
              <p className="text-gray-500 mb-1">Memo</p>
              <p className="font-medium">{bill.memo}</p>
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
            {bill.lines.map((line) => (
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

        <div className="px-5 py-4 border-t border-gray-100 flex flex-col items-end gap-1.5 text-sm">
          <div className="flex gap-16 font-semibold text-base">
            <span>Total</span>
            <span className="font-mono w-28 text-right">{fmt(bill.total)}</span>
          </div>
          {bill.amountPaid > 0 && (
            <div className="flex gap-16 text-green-700">
              <span>Paid</span>
              <span className="font-mono w-28 text-right">({fmt(bill.amountPaid)})</span>
            </div>
          )}
          {bill.amountDue > 0 && (
            <div className="flex gap-16 font-semibold text-red-600">
              <span>Balance Due</span>
              <span className="font-mono w-28 text-right">{fmt(bill.amountDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      {bill.payments.length > 0 && (
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
              {bill.payments.map((p) => (
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

      {/* Receipt attachment */}
      {bill.receiptUrl && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Receipt</h2>
          {bill.receiptUrl.endsWith(".pdf") ? (
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: "600px" }}>
                <iframe
                  src={bill.receiptUrl}
                  className="w-full h-full"
                  title="Receipt PDF"
                />
              </div>
              <a
                href={bill.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <FileText className="w-4 h-4" /> Open PDF in new tab
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bill.receiptUrl}
                alt="Receipt"
                className="max-w-md rounded-lg border border-gray-200"
              />
              <a
                href={bill.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <ImageIcon className="w-4 h-4" /> View full size
              </a>
            </div>
          )}
        </div>
      )}

      {/* Payment form (client component) */}
      {["ENTERED", "PARTIAL"].includes(bill.status) && (
        <BillPaymentForm billId={bill.id} amountDue={bill.amountDue} />
      )}
    </div>
  )
}
