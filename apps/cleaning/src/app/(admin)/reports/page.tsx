import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { PageHeader, Placeholder, UpgradeNotice } from "@/components/ui/placeholder"

export const dynamic = "force-dynamic"
const CAP = "core.reporting.basic"

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Reports" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }
  return <Placeholder title="Reports" phase="Phase 6 (reporting)" />
}
