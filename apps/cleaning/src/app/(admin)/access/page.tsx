import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listAccessItems } from "@/lib/data/access"
import { listAllSites } from "@/lib/data/service-locations"
import { listUsers } from "@/lib/data/users"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { TagIcon } from "@/components/ui/icons"
import { AccessClient } from "@/components/access/access-client"

export const dynamic = "force-dynamic"
const CAP = "operations.accessControl"

export default async function AccessPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Access & keys" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [items, sites, users] = await Promise.all([listAccessItems(orgId), listAllSites(orgId), listUsers(orgId)])
  const members = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))

  return (
    <div>
      <PageHeader title="Access & keys" subtitle="Keys, fobs, badges and codes — custody and encrypted codes" icon={<TagIcon />} />
      <AccessClient sites={sites.map((s) => ({ id: s.id, name: s.name }))} members={members} items={items} />
    </div>
  )
}
