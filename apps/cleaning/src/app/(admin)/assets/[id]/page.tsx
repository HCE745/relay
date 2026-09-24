import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getAsset } from "@/lib/data/assets"
import { listAllSites } from "@/lib/data/service-locations"
import { listUsers } from "@/lib/data/users"
import { formatMoney } from "@/lib/money"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { EditAssetButton, AddMaintenanceButton } from "@/components/assets/asset-dialogs"

export const dynamic = "force-dynamic"
const CAP = "assets.management"

const CAT: Record<string, string> = { EQUIPMENT: "Equipment", VEHICLE: "Vehicle", MACHINE: "Machine" }
const TONE: Record<string, BadgeTone> = { ACTIVE: "success", MAINTENANCE: "warning", RETIRED: "neutral" }
const STATUS: Record<string, string> = { ACTIVE: "Active", MAINTENANCE: "Maintenance", RETIRED: "Retired" }
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Asset" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { id } = await params
  const [asset, sites, users] = await Promise.all([getAsset(orgId, id), listAllSites(orgId), listUsers(orgId)])
  if (!asset) notFound()
  const siteOpts = sites.map((s) => ({ id: s.id, name: s.name }))
  const userOpts = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assets" className="text-sm text-slate-500 hover:text-brand">← Assets</Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <PageHeader title={asset.name} subtitle={CAT[asset.category] ?? asset.category} />
          <div className="flex items-center gap-3">
            <StatusBadge tone={TONE[asset.status] ?? "neutral"}>{STATUS[asset.status] ?? asset.status}</StatusBadge>
            <EditAssetButton
              asset={{
                id: asset.id, name: asset.name, category: asset.category, serial: asset.serial,
                purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : "",
                purchaseCost: asset.purchaseCost ? asset.purchaseCost.toString() : "",
                status: asset.status, assignedToSiteId: asset.assignedToSiteId, assignedToUserId: asset.assignedToUserId,
              }}
              sites={siteOpts}
              users={userOpts}
            />
          </div>
        </div>
      </div>

      <Card className="grid gap-4 p-5 sm:grid-cols-3">
        <Detail label="Serial" value={asset.serial || "—"} />
        <Detail label="Purchased" value={fmtDate(asset.purchaseDate)} />
        <Detail label="Purchase cost" value={asset.purchaseCost ? formatMoney(asset.purchaseCost) : "—"} />
        <Detail label="Assigned to site" value={asset.assignedToSite?.name || "—"} />
        <Detail label="Assigned to person" value={asset.assignedToUser?.name || "—"} />
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Maintenance log</h2>
          <AddMaintenanceButton assetId={asset.id} />
        </div>
        {asset.maintenance.length === 0 ? (
          <p className="text-sm text-slate-500">No maintenance recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {asset.maintenance.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-800">{m.type}</div>
                  <div className="text-xs text-slate-500">
                    {fmtDate(m.date)}
                    {m.performedBy?.name ? ` · ${m.performedBy.name}` : ""}
                    {m.notes ? ` · ${m.notes}` : ""}
                  </div>
                </div>
                {m.cost ? <div className="tabular-nums text-slate-600">{formatMoney(m.cost)}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}
