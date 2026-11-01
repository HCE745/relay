import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listIndirectCostPools } from "@/lib/data/indirect-costs"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { IndirectCostsManager } from "@/components/reports/indirect-costs-manager"

export const dynamic = "force-dynamic"
const CAP = "erp.siteProfitability"

export default async function IndirectCostsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard") // cost data: managers+ only
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Indirect costs" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const pools = await listIndirectCostPools(session.organizationId)
  return (
    <div>
      <PageHeader title="Indirect costs" subtitle="Allocate equipment, insurance and overhead across sites for fully-loaded margin" />
      <div className="mt-6">
        <IndirectCostsManager pools={pools} />
      </div>
    </div>
  )
}
