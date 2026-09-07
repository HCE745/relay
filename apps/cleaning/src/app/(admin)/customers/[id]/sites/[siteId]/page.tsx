import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { DateTime } from "luxon"
import { getServiceLocation } from "@/lib/data/service-locations"
import { listChecklistTemplates } from "@/lib/data/checklist-templates"
import { getChecklistTemplate } from "@/lib/data/checklist-templates"
import { getOrgTimezone } from "@/lib/data/org"
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
  const tz = site.timezone ?? (await getOrgTimezone(orgId))

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

      {site.inspections.length > 0 ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Quality history</h2>
          <ul className="divide-y divide-slate-100">
            {site.inspections.map((ins) => (
              <li key={ins.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/inspections/${ins.id}`} className="text-slate-700 hover:text-brand">
                  {ins.finalizedAt ? DateTime.fromJSDate(ins.finalizedAt, { zone: tz }).toFormat("MMM d, yyyy") : "—"} ·{" "}
                  {ins.inspector.name}
                </Link>
                <span className={ins.outcome === "PASS" ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                  {ins.outcome} · {ins.score}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ScopeSection templates={templates} />
      <ServicePlansSection
        siteId={site.id}
        plans={site.servicePlans}
        templates={templates.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  )
}
