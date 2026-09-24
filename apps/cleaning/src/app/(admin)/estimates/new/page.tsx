import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listLeads } from "@/lib/data/leads"
import { listCustomers } from "@/lib/data/customers"
import { listActiveTemplatesWithItems } from "@/lib/data/checklist-templates"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { EstimateBuilder } from "@/components/estimates/estimate-builder"

export const dynamic = "force-dynamic"
const CAP = "crm.estimates"

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="New estimate" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { leadId } = await searchParams
  const [leads, customers, templates] = await Promise.all([
    listLeads(orgId),
    listCustomers(orgId),
    listActiveTemplatesWithItems(orgId),
  ])

  return (
    <div>
      <PageHeader title="New estimate" subtitle="Price the work; convert to a customer when accepted" />
      <EstimateBuilder
        mode="create"
        presetLeadId={leadId}
        leads={leads.map((l) => ({ id: l.id, name: l.name, company: l.company }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        templates={templates}
      />
    </div>
  )
}
