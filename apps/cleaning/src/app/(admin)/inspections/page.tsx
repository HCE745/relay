import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listRecentInspections } from "@/lib/scheduling/inspections"
import { listInspectionTemplates } from "@/lib/data/inspection-templates"
import { getOrgTimezone } from "@/lib/data/org"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusPill, EmptyState } from "@/components/ui/controls"
import { NewTemplateButton } from "@/components/inspections/template-dialogs"

export const dynamic = "force-dynamic"
const CAP = "quality.inspections"

export default async function InspectionsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Inspections" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const orgId = session.organizationId
  const canManage = canManageAccounts(session.role)
  const [tz, inspections, templates] = await Promise.all([
    getOrgTimezone(orgId),
    listRecentInspections(orgId),
    listInspectionTemplates(orgId),
  ])

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Inspections" subtitle="Quality control" />
        {inspections.length === 0 ? (
          <EmptyState title="No inspections yet">Open a completed job and tap “Inspect work”.</EmptyState>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Site</th>
                  <th className="px-4 py-2.5 font-medium">Inspector</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/inspections/${i.id}`} className="font-medium text-slate-900 hover:text-brand">
                        {i.serviceLocation.customer.name} · {i.serviceLocation.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{i.inspector.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {DateTime.fromJSDate(i.createdAt, { zone: tz }).toFormat("MMM d")}
                    </td>
                    <td className="px-4 py-3">
                      {i.status === "FINALIZED" ? (
                        <span className={i.outcome === "PASS" ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                          {i.outcome} · {i.score}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">In progress</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Templates</h2>
          {canManage ? <NewTemplateButton /> : null}
        </div>
        {templates.length === 0 ? (
          <EmptyState title="No templates yet" />
        ) : (
          <Card className="divide-y divide-slate-100">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-slate-900">{t.name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {t._count.items} item{t._count.items === 1 ? "" : "s"} · pass {t.passThreshold}%
                  </span>
                </div>
                <StatusPill active={t.isActive} />
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
