import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getSupplySpendBySite } from "@/lib/data/profitability"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { DollarIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "reporting.profitability"
const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export default async function SupplySpendPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (<div><PageHeader title="Supply spend" /><UpgradeNotice capability={CAP} /></div>)
  }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const sp = await searchParams
  const from = isDate(sp.from) ? sp.from : monthStart
  const to = isDate(sp.to) ? sp.to : today

  const { rows, total } = await getSupplySpendBySite(session.organizationId, { periodStart: from, periodEnd: to })

  return (
    <div className="space-y-6">
      <PageHeader title="Supply spend" subtitle="Allocated consumable cost by site (snapshotted at time of use)" icon={<DollarIcon />} />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="mb-1 block font-medium text-slate-600">From</span>
          <input type="date" name="from" defaultValue={from} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-slate-600">To</span>
          <input type="date" name="to" defaultValue={to} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
        <button type="submit" className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Apply</button>
      </form>

      <Card className="p-5">
        <p className="text-sm text-slate-500">Total supply spend</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(total)}</p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={<DollarIcon />} title="No supply spend in this range" description="Supply cost is captured when a cleaner records usage on a job and the supply has a cost per unit set." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 text-right font-medium">Usage events</th>
                <th className="px-4 py-2.5 text-right font-medium">Supply cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.detail ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.items}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{formatMoney(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
