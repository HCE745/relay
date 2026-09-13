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
import { Card, StatusPill, StatusBadge, EmptyState } from "@/components/ui/controls"
import { ClipboardCheckIcon } from "@/components/ui/icons"
import { NewTemplateButton } from "@/components/inspections/template-dialogs"

export const dynamic = "force-dynamic"
const CAP = "quality.inspections"

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<{ outcome?: string }> }) {
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
  const [tz, allInspections, templates] = await Promise.all([
    getOrgTimezone(orgId),
    listRecentInspections(orgId),
    listInspectionTemplates(orgId),
  ])

  const { outcome } = await searchParams
  const failOnly = outcome === "FAIL"
  const inspections = failOnly ? allInspections.filter((i) => i.status === "FINALIZED" && i.outcome === "FAIL") : allInspections

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Inspections" subtitle="Quality control" />
        {failOnly ? (
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              Failed inspections
              <Link href="/inspections" className="text-red-600 hover:text-red-800" aria-label="Clear filter">
                ✕
              </Link>
            </span>
          </div>
        ) : null}
        {inspections.length === 0 ? (
          failOnly ? (
            <EmptyState
              icon={<ClipboardCheckIcon />}
              title="No failed inspections"
              description="No recent inspections have failed."
              actionLabel="View all inspections"
              actionHref="/inspections"
            />
          ) : (
            <EmptyState
              icon={<ClipboardCheckIcon />}
              title="No inspections yet"
              description="Inspections are started from a completed job. Open a completed job and tap “Inspect work” to run one."
              actionLabel="View jobs"
              actionHref="/jobs"
            />
          )
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
                        <StatusBadge tone={i.outcome === "PASS" ? "success" : "danger"}>
                          {i.outcome} · {i.score}%
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">In progress</StatusBadge>
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
          <EmptyState
            icon={<ClipboardCheckIcon />}
            title="No inspection templates yet"
            description="Build a reusable checklist of items inspectors score in the field."
            action={canManage ? <NewTemplateButton /> : undefined}
          />
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
