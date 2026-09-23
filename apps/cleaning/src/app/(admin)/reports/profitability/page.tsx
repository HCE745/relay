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
  searchParams: Promise<{ from?: string; to?: string; below?: string; include?: string }>
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
  const includeUninvoiced = sp.include === "1"

  const data = await getProfitability(session.organizationId, { periodStart: from, periodEnd: to, includeUninvoiced })
  const { summary } = data

  const flagged = (r: ProfitRow) => r.marginPct === null || r.marginPct < below

  const Table = ({ title, rows, flag }: { title: string; rows: ProfitRow[]; flag?: boolean }) => (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
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
    </div>
  )

  return (
    <div className="space-y-8">
      <PageHeader title="Profitability" subtitle="Invoiced revenue vs. approved hourly labor" />

      {/* Date range + low-margin threshold + include-uninvoiced toggle */}
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
        <label className="mb-2 inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="include" value="1" defaultChecked={includeUninvoiced} className="h-4 w-4 rounded border-slate-300" />
          Include uninvoiced jobs
        </label>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Apply
        </button>
      </form>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label={`Revenue${includeUninvoiced ? "" : " (invoiced)"}`} value={formatMoney(summary.revenue)} />
        <SummaryTile label="Labor cost" value={formatMoney(summary.laborCost)} />
        <SummaryTile label="Gross margin" value={formatMoney(summary.margin)} accent={Number(summary.margin) < 0} />
        <SummaryTile label="Margin %" value={pctText(summary.marginPct)} accent={summary.marginPct !== null && summary.marginPct < below} />
      </div>

      {/* Excluded work, kept visible */}
      {(summary.uninvoicedJobs > 0 || summary.unavailableJobs > 0) && (
        <Card className="space-y-1 border-amber-200 bg-amber-50/40 p-4 text-sm text-slate-700">
          {summary.uninvoicedJobs > 0 ? (
            <p>
              <span className="font-medium">{summary.uninvoicedJobs}</span> completed job
              {summary.uninvoicedJobs === 1 ? "" : "s"} not yet invoiced —{" "}
              <span className="font-medium">{formatMoney(summary.uninvoicedLabor)}</span> of uninvoiced labor{" "}
              {includeUninvoiced ? "(included above)" : "(excluded from margin)"}. Invoice the work, or use “Include uninvoiced jobs”.
            </p>
          ) : null}
          {summary.unavailableJobs > 0 ? (
            <p>
              <span className="font-medium">{summary.unavailableJobs}</span> job
              {summary.unavailableJobs === 1 ? "" : "s"} used salaried labor — labor cost unavailable, excluded from margin.
            </p>
          ) : null}
        </Card>
      )}

      {data.bySite.length === 0 ? (
        <EmptyState
          icon={<DollarIcon />}
          title="No jobs count toward margin in this range"
          description="Margin is built from completed, invoiced jobs with hourly labor. Widen the date range, invoice completed work, or include uninvoiced jobs above."
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
        Revenue counts only amounts on a non-void invoice. Uninvoiced completed jobs are excluded from margin by default
        (shown above as uninvoiced labor). Salaried labor cannot be costed and is excluded — never estimated. Pay-rate
        data is visible to owners, admins and managers only.
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
