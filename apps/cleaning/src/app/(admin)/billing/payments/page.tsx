import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listRecentPayments } from "@/lib/data/invoices"
import { formatMoney, invoiceNo } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { DollarIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "billing.invoicing"

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export default async function PaymentsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Payments" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const payments = await listRecentPayments(session.organizationId)
  const total = payments.reduce((acc, p) => acc + Number(p.amount.toFixed(2)), 0)

  return (
    <div>
      <PageHeader title="Payments" subtitle="Payments recorded against invoices" />

      {payments.length === 0 ? (
        <EmptyState
          icon={<DollarIcon />}
          title="No payments yet"
          description="Payments you record on sent invoices appear here. Open a sent invoice to record one."
          actionLabel="View invoices"
          actionHref="/billing/invoices"
        />
      ) : (
        <>
          <Card className="mb-6 p-5">
            <p className="text-sm text-slate-500">Recorded ({payments.length})</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(total)}</p>
          </Card>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Received</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Method</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{fmtDate(p.receivedDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{p.customerName}</td>
                    <td className="px-4 py-3">
                      <Link href={`/billing/invoices/${p.invoiceId}`} className="font-medium text-slate-900 hover:text-brand">
                        {invoiceNo(p.invoiceNumber)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.method ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
