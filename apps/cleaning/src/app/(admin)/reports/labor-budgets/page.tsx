import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getLaborBudgetVariance, listLaborBudgets, listBudgetTargets, type BudgetVarianceRow } from "@/lib/data/labor-budgets"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge, buttonClasses } from "@/components/ui/controls"
import { ChartBarIcon } from "@/components/ui/icons"
import { LaborBudgetsManager } from "@/components/reports/labor-budgets-manager"

export const dynamic = "force-dynamic"
const CAP = "erp.laborBudgets"

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const hrs = (h: { toString(): string }) => `${Number(h).toFixed(1)}h`
const pct = (p: number | null) => (p === null ? "-" : `${p.toFixed(0)}%`)
const SCOPE_LABEL: Record<string, string> = { CONTRACT: "Contract", SITE: "Site", PLAN: "Plan" }

export default async function LaborBudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard") // pay-rate-derived: managers+ only
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Labor budgets" />
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

  const [variance, budgets, targets] = await Promise.all([
    getLaborBudgetVariance(session.organizationId, { periodStart: from, periodEnd: to }),
    listLaborBudgets(session.organizationId),
    listBudgetTargets(session.organizationId),
  ])

  const unprofitable = variance.filter((r) => r.unprofitable)
  const overBudget = variance.filter((r) => r.overBudgetCost || r.overBudgetHours)

  const varianceCell = (v: { variance: { toString(): string }; pctUsed: number | null }, over: boolean, money: boolean) => (
    <td className="px-4 py-3 text-right">
      <span className={`tabular-nums ${over ? "font-medium text-red-700" : "text-slate-600"}`}>
        {Number(v.variance) > 0 ? "+" : ""}
        {money ? formatMoney(v.variance as never) : hrs(v.variance)}
      </span>
      <span className="ml-1 text-xs text-slate-400">({pct(v.pctUsed)})</span>
    </td>
  )

  return (
    <div className="space-y-8">
      <PageHeader title="Labor budgets" subtitle="Budgeted vs. scheduled vs. actual labor, with unprofitable-contract alerts" icon={<ChartBarIcon />} />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">From</span>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">To</span>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className={buttonClasses("primary", "md")}>
          Apply
        </button>
      </form>

      {/* Alerts */}
      {unprofitable.length > 0 ? (
        <Card className="space-y-1 border-red-200 bg-red-50/50 p-4 text-sm text-slate-700">
          <p className="font-medium text-red-800">
            {unprofitable.length} unprofitable {unprofitable.length === 1 ? "target" : "targets"} — actual labor cost exceeds invoiced revenue:
          </p>
          <ul className="ml-4 list-disc">
            {unprofitable.map((r) => (
              <li key={r.id}>
                {r.name} — labor {formatMoney(r.cost.actual)} vs revenue {formatMoney(r.revenue)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {variance.length === 0 ? (
        <EmptyState
          icon={<ChartBarIcon />}
          title="No active labor budgets"
          description="Add a budget for a contract, site or service plan below to track scheduled-vs-actual labor and catch unprofitable work."
        />
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Variance ({from} → {to})
            {overBudget.length > 0 ? <span className="ml-2 text-xs font-normal text-red-600">{overBudget.length} over budget</span> : null}
          </h2>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Target</th>
                  <th className="px-4 py-2.5 text-right font-medium">Budget hrs</th>
                  <th className="px-4 py-2.5 text-right font-medium">Scheduled</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actual hrs</th>
                  <th className="px-4 py-2.5 text-right font-medium">Hrs variance</th>
                  <th className="px-4 py-2.5 text-right font-medium">Budget cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actual cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost variance</th>
                  <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variance.map((r: BudgetVarianceRow) => (
                  <tr key={r.id} className={`hover:bg-slate-50 ${r.unprofitable ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{r.name}</span>
                        {r.unprofitable ? <StatusBadge tone="danger">Unprofitable</StatusBadge> : null}
                      </div>
                      <div className="text-xs text-slate-400">
                        {SCOPE_LABEL[r.scope]}
                        {r.detail ? ` · ${r.detail}` : ""}
                        {!r.laborCostKnown ? " · salaried time excluded" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{hrs(r.hours.budget)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{hrs(r.scheduledHours)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{hrs(r.hours.actual)}</td>
                    {varianceCell(r.hours, r.overBudgetHours, false)}
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatMoney(r.cost.budget)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(r.cost.actual)}</td>
                    {varianceCell(r.cost, r.overBudgetCost, true)}
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Budgets</h2>
        <LaborBudgetsManager budgets={budgets} targets={{ contracts: targets.contracts, sites: targets.sites, plans: targets.plans }} />
      </div>

      <p className="text-xs text-slate-400">
        Budgets are run-rate figures prorated to the report range (weekly ÷ 7 × days, monthly ÷ 30 × days). Scheduled
        hours come from jobs in range (crew × duration); actual hours and cost come from approved time at the
        snapshotted wage (unburdened, salaried time excluded). Planning only — not payroll processing.
      </p>
    </div>
  )
}
