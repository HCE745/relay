import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getArAging } from "@/lib/data/invoices"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { DollarIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "billing.arAging"

export default async function ArAgingPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="AR Aging" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { rows, totals } = await getArAging(session.organizationId)

  return (
    <div>
      <PageHeader title="AR Aging" subtitle="Outstanding receivables by customer and age" />

      {rows.length === 0 ? (
        <EmptyState
          icon={<DollarIcon />}
          title="Nothing outstanding"
          description="Aging shows the unpaid balance of sent invoices, bucketed by how overdue they are. You're all caught up."
          actionLabel="View invoices"
          actionHref="/billing/invoices"
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 text-right font-medium">Current</th>
                <th className="px-4 py-2.5 text-right font-medium">1–30</th>
                <th className="px-4 py-2.5 text-right font-medium">31–60</th>
                <th className="px-4 py-2.5 text-right font-medium">61–90</th>
                <th className="px-4 py-2.5 text-right font-medium">90+</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.customerId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.customerName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatMoney(r.current)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatMoney(r.d1_30)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatMoney(r.d31_60)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700">{formatMoney(r.d61_90)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-red-700">{formatMoney(r.d90)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.current)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.d1_30)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.d31_60)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.d61_90)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.d90)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  )
}
