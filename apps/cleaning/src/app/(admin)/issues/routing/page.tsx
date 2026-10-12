import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listRoutingRules } from "@/lib/data/issue-routing"
import { listUsers } from "@/lib/data/users"
import { listAllSites } from "@/lib/data/service-locations"
import { getOrgSettings } from "@/lib/data/org"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { RoutingRulesManager, type RuleRow } from "@/components/issues/routing-rules-manager"
import { InboxIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "operations.issues"

export default async function RoutingPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Issue routing" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const [rules, users, sites, org] = await Promise.all([
    listRoutingRules(session.organizationId),
    listUsers(session.organizationId),
    listAllSites(session.organizationId),
    getOrgSettings(session.organizationId),
  ])

  const activeUsers = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))
  const siteOptions = sites.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name, customerName: s.customer.name }))

  return (
    <div>
      <PageHeader title="Issue routing" subtitle="Automatically assign new issues to the right owner" icon={<InboxIcon />} />
      <div className="mb-4">
        <Link href="/issues" className="text-sm font-medium text-brand hover:underline">← Back to issues</Link>
      </div>
      <RoutingRulesManager rules={rules as unknown as RuleRow[]} users={activeUsers} sites={siteOptions} defaultAssigneeId={org?.defaultIssueAssigneeId ?? null} />
    </div>
  )
}
