import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listCredentials, listSiteRequirements } from "@/lib/data/credentials"
import { getComplianceConfig } from "@/lib/data/compliance"
import { listAllSites } from "@/lib/data/service-locations"
import { listUsers } from "@/lib/data/users"
import { credentialState } from "@/lib/credential-status"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { ClipboardCheckIcon } from "@/components/ui/icons"
import { ComplianceClient } from "@/components/compliance/compliance-client"

export const dynamic = "force-dynamic"
const CAP = "workforce.compliance"
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export default async function CompliancePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Compliance" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [creds, sites, reqs, users, cfg] = await Promise.all([
    listCredentials(orgId),
    listAllSites(orgId),
    listSiteRequirements(orgId),
    listUsers(orgId),
    getComplianceConfig(orgId),
  ])
  const now = new Date()

  const credentials = creds.map((c) => ({
    id: c.id, userId: c.userId, userName: c.user.name, type: c.type,
    issueDate: iso(c.issueDate), expiryDate: iso(c.expiryDate), status: c.status, documentRef: c.documentRef,
    state: credentialState(c, cfg.leadDays, now),
  }))
  const alerts = credentials.filter((c) => c.state === "EXPIRING" || c.state === "EXPIRED")

  const reqBySite = new Map<string, string[]>()
  for (const r of reqs) (reqBySite.get(r.serviceLocationId) ?? reqBySite.set(r.serviceLocationId, []).get(r.serviceLocationId)!).push(r.type)
  const siteProps = sites.map((s) => ({ id: s.id, name: s.name, requiredTypes: reqBySite.get(s.id) ?? [] }))
  const members = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))

  return (
    <div>
      <PageHeader title="Compliance" subtitle="Employee credentials and site requirements" icon={<ClipboardCheckIcon />} />
      <ComplianceClient members={members} credentials={credentials} sites={siteProps} alerts={alerts} />
    </div>
  )
}
