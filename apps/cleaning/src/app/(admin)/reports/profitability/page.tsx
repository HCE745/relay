import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getProfitability, type ProfitRow } from "@/lib/data/profitability"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge } from "@/components/ui/controls"
import { DollarIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "reporting.profitability"

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const pctText = (p: number | null) => (p === null ? "—" : `${p.toFixed(1)}%`)

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; below?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard") // pay-rate-derived: managers+ only
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Profitability" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const sp = await searchParams
  const from = isDate(sp.from) ? sp.from : monthStart
  const to = isDate(sp.to) ? sp.to : today
  const belowRaw = Number(sp.below)
  const below = Number.isFinite(belowRaw) && belowRaw >= 0 ? belowRaw : 20

  const data = await getProfitability(session.organizationId, { periodStart: from, periodEnd: to })
  const { totals } = data

  const flagged = (r: ProfitRow) => r.marginPct === null || r.marginPct < below

  const Table = ({ title, rows, flag }: { title: string; rows: ProfitRow[]; flag?: boolean }) => (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">No completed jobs in this range.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Jobs</th>
                <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                <th className="px-4 py-2.5 text-right font-medium">Labor cost</th>
                <th className="px-4 py-2.5 text-right font-medium">Margin</th>
                <th className="px-4 py-2.5 text-right font-medium">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const low = flag && flagged(r)
                return (
                  <tr key={r.id} className={`hover:bg-slate-50 ${low ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      {r.detail ? <div className="text-xs text-slate-400">{r.detail}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.jobs}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(r.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(r.laborCost)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${Number(r.margin) < 0 ? "text-red-700" : "text-slate-900"}`}>
                      {formatMoney(r.margin)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {low ? (
                        <StatusBadge tone="danger">{pctText(r.marginPct)}</StatusBadge>
                      ) : (
                        <span className="tabular-nums text-slate-700">{pctText(r.marginPct)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      <PageHeader title="Profitability" subtitle="Revenue vs. labor cost — invoiced revenue and approved-time labor" />

      {/* Date range + low-margin threshold */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">From</span>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">To</span>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">Flag margin below (%)</span>
          <input type="number" name="below" min={0} max={100} defaultValue={below} className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Apply
        </button>
      </form>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Revenue (invoiced)" value={formatMoney(totals.revenue)} />
        <SummaryTile label="Labor cost" value={formatMoney(totals.laborCost)} />
        <SummaryTile label="Gross margin" value={formatMoney(totals.margin)} accent={Number(totals.margin) < 0} />
        <SummaryTile label="Margin %" value={pctText(totals.marginPct)} accent={totals.marginPct !== null && totals.marginPct < below} />
      </div>

      {data.bySite.length === 0 ? (
        <EmptyState
          icon={<DollarIcon />}
          title="No completed jobs in this range"
          description="Profitability is built from completed jobs with invoiced revenue and approved time. Widen the date range, or complete and invoice some work."
          actionLabel="View jobs"
          actionHref="/jobs"
        />
      ) : (
        <>
          <Table title="By site" rows={data.bySite} flag />
          <Table title="By customer" rows={data.byCustomer} />
          <Table title="By service plan" rows={data.byPlan} />
        </>
      )}

      <p className="text-xs text-slate-400">
        Revenue counts only amounts on a non-void invoice; a completed job not yet invoiced shows labor with no revenue.
        Salaried labor is costed at rate ÷ 2080 hrs/yr. Pay-rate data is visible to owners, admins and managers only.
      </p>
    </div>
  )
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? "text-red-700" : "text-slate-900"}`}>{value}</p>
    </Card>
  )
}
