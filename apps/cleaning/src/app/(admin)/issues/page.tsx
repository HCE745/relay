import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { PageHeader, Placeholder, UpgradeNotice } from "@/components/ui/placeholder"

export const dynamic = "force-dynamic"
const CAP = "operations.issues"

export default async function IssuesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Issues" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }
  return <Placeholder title="Issues" phase="Phase 5 (issues & corrective actions)" />
}
