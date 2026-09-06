import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { getServiceLocation } from "@/lib/data/service-locations"
import { listChecklistTemplates } from "@/lib/data/checklist-templates"
import { getChecklistTemplate } from "@/lib/data/checklist-templates"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusPill } from "@/components/ui/controls"
import { SiteEditButton } from "@/components/sites/site-edit"
import { ScopeSection, type ChecklistTemplate } from "@/components/sites/scope-section"
import { ServicePlansSection } from "@/components/sites/service-plans-section"

export const dynamic = "force-dynamic"

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string; siteId: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")

  const { id: customerId, siteId } = await params
  const orgId = session.organizationId

  const site = await getServiceLocation(orgId, siteId)
  if (!site || site.customerId !== customerId) notFound()

  // Org-level checklist library, hydrated with items for the editor.
  const templateSummaries = await listChecklistTemplates(orgId)
  const templates = (await Promise.all(
    templateSummaries.map((t) => getChecklistTemplate(orgId, t.id)),
  )).filter(Boolean) as ChecklistTemplate[]

  const address = [site.addressLine1, site.city, site.state, site.postalCode].filter(Boolean).join(", ")

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/customers/${customerId}`} className="text-sm text-slate-500 hover:text-brand">
          ← {site.customer.name}
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <PageHeader title={site.name} subtitle={address || undefined} />
          <div className="flex items-center gap-3">
            <StatusPill active={site.isActive} />
            <SiteEditButton
              site={{
                id: site.id,
                name: site.name,
                addressLine1: site.addressLine1,
                city: site.city,
                state: site.state,
                postalCode: site.postalCode,
                timezone: site.timezone,
                siteContactName: site.siteContactName,
                siteContactPhone: site.siteContactPhone,
                notes: site.notes,
                isActive: site.isActive,
              }}
            />
          </div>
        </div>
      </div>

      {(site.siteContactName || site.notes) && (
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          {site.siteContactName ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Site contact</dt>
              <dd className="text-sm text-slate-800">
                {site.siteContactName}
                {site.siteContactPhone ? ` · ${site.siteContactPhone}` : ""}
              </dd>
            </div>
          ) : null}
          {site.notes ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Access / notes</dt>
              <dd className="whitespace-pre-wrap text-sm text-slate-800">{site.notes}</dd>
            </div>
          ) : null}
        </Card>
      )}

      <ScopeSection templates={templates} />
      <ServicePlansSection
        siteId={site.id}
        plans={site.servicePlans}
        templates={templates.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  )
}
