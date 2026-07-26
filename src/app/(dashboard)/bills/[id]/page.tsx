import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText, Image as ImageIcon } from "lucide-react"
import { BillPaymentForm } from "@/components/bills/BillPaymentForm"
import { StatusBadge } from "@/components/ui/StatusBadge"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
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
    <div className="p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bills" className="hover:text-slate-600 transition-colors" style={{ color: "var(--text-faint)" }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="page-title flex-1">Bill {bill.billNumber ?? bill.id.slice(0, 8)}</h1>
        <StatusBadge status={bill.status} />
      </div>

      {/* Meta */}
      <div className="card p-6">
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Vendor</p>
            <p className="font-semibold" style={{ color: "var(--text-base)" }}>{bill.vendor.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Bill Date</p>
            <p className="fin font-medium">{bill.date.toISOString().slice(0, 10)}</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Due Date</p>
            <p className="fin font-medium">{bill.dueDate.toISOString().slice(0, 10)}</p>
          </div>
          {bill.memo && (
            <div className="col-span-3">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>Memo</p>
              <p className="font-medium">{bill.memo}</p>
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
            {bill.lines.map((line) => (
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
          <div className="flex gap-16 font-semibold text-base">
            <span>Total</span>
            <span className="fin w-28 text-right">{fmt(bill.total)}</span>
          </div>
          {bill.amountPaid > 0 && (
            <div className="flex gap-16 text-green-700">
              <span>Paid</span>
              <span className="fin w-28 text-right">({fmt(bill.amountPaid)})</span>
            </div>
          )}
          {bill.amountDue > 0 && (
            <div className="flex gap-16 font-semibold text-red-600">
              <span>Balance Due</span>
              <span className="fin w-28 text-right">{fmt(bill.amountDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      {bill.payments.length > 0 && (
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
              {bill.payments.map((p) => (
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

      {/* Receipt attachment */}
      {bill.receiptUrl && (
        <div className="card p-6">
          <h2 className="card-header-title mb-4">Receipt</h2>
          {bill.receiptUrl.endsWith(".pdf") ? (
            <div className="space-y-3">
              <div className="border rounded-lg overflow-hidden" style={{ height: "600px", borderColor: "var(--border)" }}>
                <iframe src={bill.receiptUrl} className="w-full h-full" title="Receipt PDF" />
              </div>
              <a href={bill.receiptUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--accent)" }}>
                <FileText className="w-4 h-4" /> Open PDF in new tab
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bill.receiptUrl} alt="Receipt" className="max-w-md rounded-lg border" style={{ borderColor: "var(--border)" }} />
              <a href={bill.receiptUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--accent)" }}>
                <ImageIcon className="w-4 h-4" /> View full size
              </a>
            </div>
          )}
        </div>
      )}

      {/* Payment form */}
      {["ENTERED", "PARTIAL"].includes(bill.status) && (
        <BillPaymentForm billId={bill.id} amountDue={bill.amountDue} />
      )}
    </div>
  )
}
