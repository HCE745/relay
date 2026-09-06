import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { PageHeader, Placeholder, UpgradeNotice } from "@/components/ui/placeholder"

export const dynamic = "force-dynamic"
const CAP = "workforce.timeTracking"

export default async function TimePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Time" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }
  return <Placeholder title="Time" phase="Phase 3–4 (timesheets & approvals)" />
}
