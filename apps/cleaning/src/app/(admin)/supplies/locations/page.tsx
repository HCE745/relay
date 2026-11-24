import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts, canManageOrg } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { prisma } from "@/lib/prisma"
import { listInventoryLocations } from "@/lib/data/inventory"
import { listAllSites } from "@/lib/data/service-locations"
import { listUsers } from "@/lib/data/users"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { BoxIcon } from "@/components/ui/icons"
import { InventoryLocationsClient } from "@/components/inventory/locations-client"

export const dynamic = "force-dynamic"
const CAP = "supplies.inventory"

export default async function InventoryLocationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Inventory locations" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [locations, sites, users, org] = await Promise.all([
    listInventoryLocations(orgId),
    listAllSites(orgId),
    listUsers(orgId),
    prisma.organization.findUnique({ where: { id: orgId }, select: { invTrackLocations: true, invAutoEstimate: true, invRequireManualUsage: true } }),
  ])

  return (
    <div className="space-y-5">
      <div>
        <Link href="/supplies" className="text-sm text-slate-500 hover:text-brand">← Supplies</Link>
        <PageHeader title="Inventory locations & policy" subtitle="Where stock is held — warehouses, supply stations, customer closets, vehicles, crews" icon={<BoxIcon />} />
      </div>
      <InventoryLocationsClient
        locations={locations.map((l) => ({
          id: l.id, name: l.name, kind: l.kind, isActive: l.isActive, qrToken: l.qrToken,
          binding: l.serviceLocation?.name ?? l.holder?.name ?? null, stockCount: l._count.stockLevels,
        }))}
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        users={users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))}
        policy={org ?? { invTrackLocations: false, invAutoEstimate: false, invRequireManualUsage: false }}
        canEditPolicy={canManageOrg(session.role)}
      />
    </div>
  )
}
