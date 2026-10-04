import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listExportHistory } from "@/lib/data/exports"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { FileTextIcon } from "@/components/ui/icons"
import { ExportsClient } from "@/components/exports/exports-client"

export const dynamic = "force-dynamic"
const CAP = "integrations.exports"

export default async function ExportsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Exports" /><UpgradeNotice capability={CAP} /></div>)
  }

  const history = await listExportHistory(orgId)
  return (
    <div>
      <PageHeader title="Exports" subtitle="QuickBooks, Xero, Gusto & ADP — CSV import files" icon={<FileTextIcon />} />
      <ExportsClient
        history={history.map((r) => ({
          id: r.id, type: r.type, rowCount: r.rowCount, createdByName: r.createdByName,
          createdAt: r.createdAt.toISOString(), periodStart: r.periodStart?.toISOString() ?? null, periodEnd: r.periodEnd?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}
