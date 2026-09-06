import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { PageHeader, Placeholder, UpgradeNotice } from "@/components/ui/placeholder"

export const dynamic = "force-dynamic"
const CAP = "workforce.employees"

export default async function TeamPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Team" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }
  return <Placeholder title="Team" phase="Phase 0–2 (employee records & assignments)" />
}
