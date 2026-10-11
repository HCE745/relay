import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listImportBatches } from "@/lib/data/imports"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { FileTextIcon } from "@/components/ui/icons"
import { ImportClient } from "@/components/import/import-client"

export const dynamic = "force-dynamic"
const CAP = "operations.dataImport"

export default async function ImportPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Import" /><UpgradeNotice capability={CAP} /></div>)
  }
  const batches = await listImportBatches(orgId)
  const latestId = batches.find((b) => !b.rolledBackAt)?.id ?? null

  return (
    <div>
      <PageHeader title="Import customers" subtitle="Bulk-load customers, sites and contacts from a CSV" icon={<FileTextIcon />} />
      <ImportClient
        batches={batches.map((b) => ({ id: b.id, filename: b.filename, customersCreated: b.customersCreated, sitesCreated: b.sitesCreated, contactsCreated: b.contactsCreated, createdAt: b.createdAt.toISOString(), rolledBackAt: b.rolledBackAt?.toISOString() ?? null }))}
        latestId={latestId}
      />
    </div>
  )
}
