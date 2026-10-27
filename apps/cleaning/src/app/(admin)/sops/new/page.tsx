import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { sopFormOptions } from "@/lib/data/sops"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { SopEditor } from "@/components/sops/sop-editor"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"

export default async function NewSopPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="New SOP" /><UpgradeNotice capability={CAP} /></div>)
  }
  const { sites, plans } = await sopFormOptions(orgId)
  return (
    <div>
      <PageHeader title="New SOP" subtitle="Draft a procedure. Publish it when ready." />
      <SopEditor mode="new" sites={sites} plans={plans} />
    </div>
  )
}
