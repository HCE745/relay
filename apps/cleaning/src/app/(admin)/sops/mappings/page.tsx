import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listIssueMappings, listPublishedSops } from "@/lib/data/sops"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { SopMappingManager } from "@/components/sops/sop-mapping-manager"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"

export default async function SopMappingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="SOP mappings" /><UpgradeNotice capability={CAP} /></div>)
  }
  const [mappings, sops] = await Promise.all([listIssueMappings(orgId), listPublishedSops(orgId)])
  return (
    <div className="space-y-5">
      <div><Link href="/sops" className="text-sm text-slate-500 hover:text-brand">← SOPs</Link></div>
      <PageHeader title="Issue-category SOP mappings" subtitle="When an issue of a category is opened, the mapped procedure shows inline. Set by you, never inferred." />
      <SopMappingManager mappings={mappings.map((m) => ({ id: m.id, issueCategory: m.issueCategory, sop: m.sop }))} sops={sops.map((s) => ({ id: s.id, title: s.title }))} />
    </div>
  )
}
