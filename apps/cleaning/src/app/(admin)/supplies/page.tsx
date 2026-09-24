import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listSupplies, isLowStock } from "@/lib/data/supplies"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge } from "@/components/ui/controls"
import { InboxIcon } from "@/components/ui/icons"
import { NewSupplyButton } from "@/components/supplies/supply-dialogs"

export const dynamic = "force-dynamic"
const CAP = "supplies.inventory"

const qty = (d: { toString(): string }) => Number(d.toString()).toString()

export default async function SuppliesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Supplies" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { filter } = await searchParams
  const lowOnly = filter === "low"
  const all = await listSupplies(orgId)
  const supplies = lowOnly ? all.filter(isLowStock) : all

  return (
    <div>
      <PageHeader title="Supplies" subtitle="Stock levels and usage" action={<NewSupplyButton />} />

      <div className="mb-4 flex gap-2">
        <Link href="/supplies" className={`rounded-full px-3 py-1 text-sm font-medium ${!lowOnly ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>All</Link>
        <Link href="/supplies?filter=low" className={`rounded-full px-3 py-1 text-sm font-medium ${lowOnly ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>Low stock</Link>
      </div>

      {supplies.length === 0 ? (
        <EmptyState
          icon={<InboxIcon />}
          title={lowOnly ? "Nothing low on stock" : "No supplies yet"}
          description={lowOnly ? "Every supply is above its reorder point." : "Track consumables here. Cleaners log usage from the job screen and stock decrements automatically."}
          actionLabel={lowOnly ? "View all supplies" : undefined}
          actionHref={lowOnly ? "/supplies" : undefined}
          action={lowOnly ? undefined : <NewSupplyButton />}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Supply</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 text-right font-medium">In stock</th>
                <th className="px-4 py-2.5 text-right font-medium">Reorder at</th>
                <th className="px-4 py-2.5 text-right font-medium">Cost / unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplies.map((s) => {
                const low = isLowStock(s)
                return (
                  <tr key={s.id} className={`hover:bg-slate-50 ${low ? "bg-orange-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/supplies/${s.id}`} className="font-medium text-slate-900 hover:text-brand">{s.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.unit}</td>
                    <td className="px-4 py-3 text-right">
                      {low ? <StatusBadge tone="warning">{qty(s.currentStock)} · low</StatusBadge> : <span className="tabular-nums text-slate-700">{qty(s.currentStock)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{qty(s.reorderThreshold)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{s.costPerUnit ? formatMoney(s.costPerUnit) : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
