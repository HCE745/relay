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
import { BoxIcon } from "@/components/ui/icons"
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
      <PageHeader title="Assets" subtitle="Equipment, vehicles and machines" icon={<BoxIcon />} action={<NewAssetButton sites={siteOpts} users={userOpts} />} />

      {assets.length === 0 ? (
        <EmptyState
          icon={<BoxIcon />}
          title="No assets yet"
          description="Track your equipment, vehicles and machines here, with a maintenance log for each."
          action={<NewAssetButton sites={siteOpts} users={userOpts} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((a) => (
            <Link key={a.id} href={`/assets/${a.id}`} className="group">
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <BoxIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 group-hover:text-brand">{a.name}</div>
                      <div className="truncate text-xs text-slate-500">{CAT[a.category] ?? a.category}{a.serial ? ` · ${a.serial}` : ""}</div>
                    </div>
                  </div>
                  <StatusBadge tone={TONE[a.status] ?? "neutral"}>{STATUS[a.status] ?? a.status}</StatusBadge>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="truncate">{a.assignedToSite?.name ?? a.assignedToUser?.name ?? "Unassigned"}</span>
                  <span className="shrink-0">{a._count.maintenance} log{a._count.maintenance === 1 ? "" : "s"}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
