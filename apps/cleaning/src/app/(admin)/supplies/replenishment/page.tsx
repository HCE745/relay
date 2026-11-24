import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listReplenishmentRequests } from "@/lib/data/inventory"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { BoxIcon } from "@/components/ui/icons"
import { ReplenishmentClient } from "@/components/inventory/replenishment-client"

export const dynamic = "force-dynamic"
const CAP = "supplies.inventory"

export default async function ReplenishmentPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Replenishment" /><UpgradeNotice capability={CAP} /></div>)
  }
  const requests = await listReplenishmentRequests(orgId)

  return (
    <div className="space-y-5">
      <div>
        <Link href="/supplies" className="text-sm text-slate-500 hover:text-brand">← Supplies</Link>
        <PageHeader title="Replenishment requests" subtitle="Low-stock and supply requests from the field — review, fulfill, close" icon={<BoxIcon />} />
      </div>
      <ReplenishmentClient
        requests={requests.map((r) => ({
          id: r.id, status: r.status,
          supply: r.supply?.name ?? null, unit: r.supply?.unit ?? null,
          location: r.inventoryLocation?.name ?? null,
          quantity: r.quantity != null ? Number(r.quantity).toString() : null,
          note: r.note, requestedBy: r.requestedBy.name, reviewedBy: r.reviewedBy?.name ?? null,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
