import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listCollectionSteps } from "@/lib/data/collections"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { CollectionsManager } from "@/components/billing/collections-manager"

export const dynamic = "force-dynamic"
const CAP = "billing.invoicing"

export default async function CollectionsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Collections" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const steps = await listCollectionSteps(session.organizationId)
  return (
    <div>
      <PageHeader title="Collections" subtitle="An escalating reminder sequence for overdue invoices" />
      <div className="mt-6">
        <CollectionsManager
          steps={steps.map((s) => ({ id: s.id, dayOffset: s.dayOffset, channel: s.channel, subject: s.subject, body: s.body, isActive: s.isActive }))}
        />
      </div>
    </div>
  )
}
