import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { DateTime } from "luxon"
import { listAccessItems } from "@/lib/data/access"
import { listCheckoutJobs } from "@/lib/data/custody"
import { listAllSites } from "@/lib/data/service-locations"
import { listUsers } from "@/lib/data/users"
import { getOrgTimezone } from "@/lib/data/org"
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

  const [items, sites, users, jobRows, tz] = await Promise.all([
    listAccessItems(orgId), listAllSites(orgId), listUsers(orgId), listCheckoutJobs(orgId), getOrgTimezone(orgId),
  ])
  const members = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))
  const jobs = jobRows.map((j) => ({
    id: j.id,
    label: `${j.title} (${DateTime.fromJSDate(j.scheduledStart, { zone: tz }).toFormat("MMM d")}${j.serviceLocation ? `, ${j.serviceLocation.name}` : ""})`,
  }))

  return (
    <div>
      <PageHeader title="Access & keys" subtitle="Keys, fobs, badges and codes: custody and encrypted codes" icon={<TagIcon />} />
      <AccessClient sites={sites.map((s) => ({ id: s.id, name: s.name }))} members={members} items={items} jobs={jobs} />
    </div>
  )
}
