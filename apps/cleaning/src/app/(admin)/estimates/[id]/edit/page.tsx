import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getEstimate } from "@/lib/data/estimates"
import { listLeads } from "@/lib/data/leads"
import { listCustomers } from "@/lib/data/customers"
import { listActiveTemplatesWithItems } from "@/lib/data/checklist-templates"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { EstimateBuilder } from "@/components/estimates/estimate-builder"

export const dynamic = "force-dynamic"
const CAP = "crm.estimates"

const dateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null)

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (
      <div>
        <PageHeader title="Edit estimate" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { id } = await params
  const est = await getEstimate(orgId, id)
  if (!est) notFound()
  // Converted estimates are read-only — never editable.
  if (est.convertedCustomerId) redirect(`/estimates/${id}`)

  const [leads, customers, templates] = await Promise.all([
    listLeads(orgId),
    listCustomers(orgId),
    listActiveTemplatesWithItems(orgId),
  ])

  return (
    <div>
      <PageHeader title="Edit estimate" subtitle={est.title} />
      <EstimateBuilder
        mode="edit"
        estimateId={est.id}
        initial={{
          id: est.id,
          title: est.title,
          leadId: est.leadId,
          customerId: est.customerId,
          contactName: est.contactName,
          contactEmail: est.contactEmail,
          contactPhone: est.contactPhone,
          siteName: est.siteName,
          addressLine1: est.addressLine1,
          city: est.city,
          state: est.state,
          postalCode: est.postalCode,
          frequency: est.frequency,
          pricing: est.pricing,
          rate: est.rate ? est.rate.toString() : null,
          currency: est.currency,
          checklistTemplateId: est.checklistTemplateId,
          validUntil: dateInput(est.validUntil),
          notes: est.notes,
          lines: est.lines.map((l) => ({ description: l.description, quantity: l.quantity.toString(), unitRate: l.unitRate.toString() })),
        }}
        leads={leads.map((l) => ({ id: l.id, name: l.name, company: l.company }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        templates={templates}
      />
    </div>
  )
}
