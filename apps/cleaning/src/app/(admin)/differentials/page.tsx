import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listDifferentialRules } from "@/lib/data/shift-differentials"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { DifferentialsManager } from "@/components/pay/differentials-manager"

export const dynamic = "force-dynamic"
const CAP = "workforce.laborCosting"

export default async function DifferentialsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Shift differentials" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const rules = await listDifferentialRules(session.organizationId)
  return (
    <div>
      <PageHeader title="Shift differentials" subtitle="Night and weekend premiums applied to approved hours" />
      <div className="mt-6">
        <DifferentialsManager rules={rules} />
      </div>
    </div>
  )
}
