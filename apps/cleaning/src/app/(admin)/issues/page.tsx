import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listIssues } from "@/lib/data/issues"
import { getOrgTimezone } from "@/lib/data/org"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { InboxIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "operations.issues"

const STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"]
const STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: "danger",
  ACKNOWLEDGED: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
}

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Issues" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const { status } = await searchParams
  const [tz, issues] = await Promise.all([
    getOrgTimezone(session.organizationId),
    listIssues(session.organizationId, status ? { status } : {}),
  ])

  return (
    <div>
      <PageHeader title="Issues" subtitle="Problems reported from the field and failed inspections" />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip label="All" href="/issues" active={!status} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s.charAt(0) + s.slice(1).toLowerCase()} href={`/issues?status=${s}`} active={status === s} />
        ))}
      </div>

      {issues.length === 0 ? (
        status ? (
          <EmptyState
            icon={<InboxIcon />}
            title={`No ${status.toLowerCase()} issues`}
            description="Nothing matches this filter right now."
            actionLabel="View all issues"
            actionHref="/issues"
          />
        ) : (
          <EmptyState
            icon={<InboxIcon />}
            title="No issues reported"
            description="Problems reported from the field and failed inspections show up here to triage. Nothing to do right now."
            actionLabel="View jobs"
            actionHref="/jobs"
            secondaryLabel="Run an inspection"
            secondaryHref="/inspections"
          />
        )
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Issue</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-4 py-2.5 font-medium">Assignee</th>
                <th className="px-4 py-2.5 font-medium">Opened</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issues.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/issues/${i.id}`} className="font-medium text-slate-900 hover:text-brand">
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{i.category}</span>
                      {i.title ?? i.description.slice(0, 60)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{i.inspection ? "Inspection" : "Field report"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {i.serviceLocation ? `${i.serviceLocation.customer.name} · ${i.serviceLocation.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.assignedTo?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{DateTime.fromJSDate(i.createdAt, { zone: tz }).toFormat("MMM d")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={STATUS_TONE[i.status] ?? "neutral"}>{i.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </Link>
  )
}
