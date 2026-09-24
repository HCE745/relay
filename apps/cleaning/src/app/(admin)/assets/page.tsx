import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listAssets } from "@/lib/data/assets"
import { listAllSites } from "@/lib/data/service-locations"
import { listUsers } from "@/lib/data/users"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { BriefcaseIcon } from "@/components/ui/icons"
import { NewAssetButton } from "@/components/assets/asset-dialogs"

export const dynamic = "force-dynamic"
const CAP = "assets.management"

const CAT: Record<string, string> = { EQUIPMENT: "Equipment", VEHICLE: "Vehicle", MACHINE: "Machine" }
const TONE: Record<string, BadgeTone> = { ACTIVE: "success", MAINTENANCE: "warning", RETIRED: "neutral" }
const STATUS: Record<string, string> = { ACTIVE: "Active", MAINTENANCE: "Maintenance", RETIRED: "Retired" }

export default async function AssetsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Assets" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const [assets, sites, users] = await Promise.all([listAssets(orgId), listAllSites(orgId), listUsers(orgId)])
  const siteOpts = sites.map((s) => ({ id: s.id, name: s.name }))
  const userOpts = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))

  return (
    <div>
      <PageHeader title="Assets" subtitle="Equipment, vehicles and machines" action={<NewAssetButton sites={siteOpts} users={userOpts} />} />

      {assets.length === 0 ? (
        <EmptyState
          icon={<BriefcaseIcon />}
          title="No assets yet"
          description="Track your equipment, vehicles and machines here, with a maintenance log for each."
          action={<NewAssetButton sites={siteOpts} users={userOpts} />}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Asset</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Serial</th>
                <th className="px-4 py-2.5 font-medium">Assigned</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Maintenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/assets/${a.id}`} className="font-medium text-slate-900 hover:text-brand">{a.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{CAT[a.category] ?? a.category}</td>
                  <td className="px-4 py-3 text-slate-500">{a.serial || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.assignedToSite?.name ?? a.assignedToUser?.name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge tone={TONE[a.status] ?? "neutral"}>{STATUS[a.status] ?? a.status}</StatusBadge></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{a._count.maintenance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
