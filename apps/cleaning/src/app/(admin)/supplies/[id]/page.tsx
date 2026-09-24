import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getSupply, isLowStock } from "@/lib/data/supplies"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge } from "@/components/ui/controls"
import { EditSupplyButton, AdjustStockButton } from "@/components/supplies/supply-dialogs"

export const dynamic = "force-dynamic"
const CAP = "supplies.inventory"

const qty = (d: { toString(): string }) => Number(d.toString()).toString()
const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export default async function SupplyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Supply" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { id } = await params
  const supply = await getSupply(orgId, id)
  if (!supply) notFound()
  const low = isLowStock(supply)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/supplies" className="text-sm text-slate-500 hover:text-brand">← Supplies</Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <PageHeader title={supply.name} subtitle={`Measured in ${supply.unit}s`} />
          <div className="flex items-center gap-2">
            <AdjustStockButton supplyId={supply.id} unit={supply.unit} />
            <EditSupplyButton
              supply={{ id: supply.id, name: supply.name, unit: supply.unit, reorderThreshold: supply.reorderThreshold.toString(), costPerUnit: supply.costPerUnit ? supply.costPerUnit.toString() : "" }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">In stock</p>
          <p className={`mt-1 text-2xl font-semibold ${low ? "text-orange-600" : "text-slate-900"}`}>
            {qty(supply.currentStock)} {low ? <StatusBadge tone="warning" className="ml-1 align-middle">Low</StatusBadge> : null}
          </p>
        </Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Reorder at</p><p className="mt-1 text-2xl font-semibold text-slate-900">{qty(supply.reorderThreshold)}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Cost / unit</p><p className="mt-1 text-2xl font-semibold text-slate-900">{supply.costPerUnit ? formatMoney(supply.costPerUnit) : "—"}</p></Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Usage log</h2>
        {supply.usages.length === 0 ? (
          <p className="text-sm text-slate-500">No usage recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {supply.usages.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="text-slate-600">
                  {fmtDate(u.createdAt)} · {u.recordedBy.name}
                  {u.serviceLocation?.name ? ` · ${u.serviceLocation.name}` : ""}
                  {u.job?.title ? ` · ${u.job.title}` : ""}
                </div>
                <div className="tabular-nums text-red-700">−{qty(u.quantity)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Stock adjustments</h2>
        {supply.adjustments.length === 0 ? (
          <p className="text-sm text-slate-500">No manual adjustments.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {supply.adjustments.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="text-slate-600">
                  {fmtDate(a.createdAt)}
                  {a.adjustedBy?.name ? ` · ${a.adjustedBy.name}` : ""} · {a.reason}
                </div>
                <div className={`tabular-nums ${Number(a.delta) < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {Number(a.delta) < 0 ? "" : "+"}{qty(a.delta)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
