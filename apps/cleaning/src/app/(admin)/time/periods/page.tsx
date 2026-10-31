import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts, canManageOrg } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listPayPeriods } from "@/lib/data/pay-periods"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { PayPeriodsManager } from "@/components/time/pay-periods-manager"

export const dynamic = "force-dynamic"
const CAP = "workforce.payrollExport"

export default async function PayPeriodsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Pay periods" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const periods = await listPayPeriods(session.organizationId)
  return (
    <div>
      <PageHeader title="Pay periods" subtitle="Lock a payroll period after export so its time and earnings can't change" />
      <div className="mt-6">
        <PayPeriodsManager
          canUnlock={canManageOrg(session.role)}
          periods={periods.map((p) => ({
            id: p.id,
            start: p.start.toISOString(),
            end: p.end.toISOString(),
            status: p.status,
            lockedByName: p.lockedByName,
            lockedAt: p.lockedAt ? p.lockedAt.toISOString() : null,
            exportCount: p.exportCount,
          }))}
        />
      </div>
    </div>
  )
}
