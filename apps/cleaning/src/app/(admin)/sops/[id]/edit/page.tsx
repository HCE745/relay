import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getSopForEdit, sopFormOptions } from "@/lib/data/sops"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { SopEditor, type SopEditValue } from "@/components/sops/sop-editor"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"

export default async function EditSopPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Edit SOP" /><UpgradeNotice capability={CAP} /></div>)
  }
  const { id } = await params
  const data = await getSopForEdit(orgId, id)
  if (!data || !data.current) notFound()
  // Published versions are immutable — editing happens on a draft (revise first).
  if (data.current.publishedAt) redirect(`/sops/${id}`)

  const sop = data.sop
  const [{ sites, plans }] = await Promise.all([sopFormOptions(orgId)])
  const initial: SopEditValue = {
    title: sop.title, category: sop.category, keywords: sop.keywords ?? "", attachmentUrl: sop.attachmentUrl ?? "",
    requiresAck: sop.requiresAck, reackIntervalDays: sop.reackIntervalDays ? String(sop.reackIntervalDays) : "",
    appliesEveryone: sop.appliesEveryone, appliesRoles: sop.appliesRoles, appliesSiteIds: sop.appliesSiteIds, appliesServicePlanIds: sop.appliesServicePlanIds,
    sections: data.current.sections.map((s) => ({ heading: s.heading, body: s.body })),
  }
  return (
    <div>
      <PageHeader title={`Edit: ${sop.title}`} subtitle={`Draft v${sop.currentVersion}`} />
      <SopEditor mode="edit" sopId={id} initial={initial} sites={sites} plans={plans} />
    </div>
  )
}
