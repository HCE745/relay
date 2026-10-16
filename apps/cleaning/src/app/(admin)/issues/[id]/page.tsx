import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageAccounts } from "@/lib/rbac"
import { getIssue, listIssueActivity } from "@/lib/data/issues"
import { listUsers } from "@/lib/data/users"
import { listAssets } from "@/lib/data/assets"
import { getOrgTimezone } from "@/lib/data/org"
import { orgHasCapability } from "@/lib/page-guards"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { IssueStatusBar, IssueAssignee, IssueCommentBox, IssueAssetLink } from "@/components/issues/issue-actions"
import { IssueToWorkOrderButton } from "@/components/issues/issue-to-work-order"

export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700",
  ACKNOWLEDGED: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
}

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")

  const { id } = await params
  const orgId = session.organizationId
  const issue = await getIssue(orgId, id)
  if (!issue) notFound()

  const [tz, activity, users, canMakeWorkOrder, hasAssets] = await Promise.all([
    getOrgTimezone(orgId),
    listIssueActivity(orgId, id),
    // Assignable = active team members (managers assign to anyone active).
    listUsers(orgId).then((all) => all.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))),
    canManageAccounts(session.role) ? orgHasCapability(orgId, "operations.workOrders") : Promise.resolve(false),
    orgHasCapability(orgId, "assets.management"),
  ])
  // Asset linking only when the org has the asset register.
  const assets = hasAssets
    ? (await listAssets(orgId)).map((a) => ({ id: a.id, name: a.name }))
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/issues" className="text-sm text-slate-500 hover:text-brand">
          ← Issues
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <PageHeader
            title={issue.title ?? "Reported problem"}
            subtitle={issue.serviceLocation ? `${issue.serviceLocation.customer.name} · ${issue.serviceLocation.name}` : undefined}
          />
          <div className="flex items-center gap-3">
            {canMakeWorkOrder ? <IssueToWorkOrderButton issueId={issue.id} /> : null}
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[issue.status]}`}>{issue.status}</span>
          </div>
        </div>
      </div>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Detail label="Source" value={issue.externalReporter ? `${issue.source === "SMS" ? "SMS" : issue.source === "QR" ? "QR" : "External"} · ${issue.externalReporter}` : issue.source === "SMS" ? "SMS" : issue.inspection ? "Failed inspection" : "Field report"} />
        <Detail label="Category" value={issue.category} />
        <Detail label="Severity" value={issue.severity} />
        <Detail label="Reported by" value={issue.reportedBy?.name ?? (issue.source === "QR" ? "External occupant (QR)" : "-")} />
        <Detail
          label="Opened"
          value={DateTime.fromJSDate(issue.createdAt, { zone: tz }).toFormat("MMM d, yyyy · h:mm a")}
        />
        <Detail label="Resolve by" value={issue.resolveDeadline ? DateTime.fromJSDate(issue.resolveDeadline, { zone: tz }).toFormat("MMM d, h:mm a") + (issue.status !== "CLOSED" && issue.status !== "RESOLVED" && issue.resolveDeadline < new Date() ? " · OVERDUE" : "") : "-"} />
        <Detail label="Owner (resolver)" value={issue.assignedTo?.name ?? "Unassigned"} />
        <Detail label="Verified by" value={issue.verifier?.name ?? (issue.status === "CLOSED" ? "-" : "Pending verification")} />
        {issue.escalationLevel > 0 ? <Detail label="Escalation level" value={String(issue.escalationLevel)} /> : null}
        {issue.reopenCount > 0 ? <Detail label="Reopened" value={`${issue.reopenCount}×`} /> : null}
        {issue.job ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Job</dt>
            <dd className="text-sm">
              <Link href={`/jobs/${issue.job.id}`} className="text-brand hover:underline">
                {issue.job.title}
              </Link>
            </dd>
          </div>
        ) : null}
        {issue.inspection ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Inspection</dt>
            <dd className="text-sm">
              <Link href={`/inspections/${issue.inspection.id}`} className="text-brand hover:underline">
                {issue.inspection.outcome} · {issue.inspection.score}%
              </Link>
            </dd>
          </div>
        ) : null}
        {issue.asset ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Asset</dt>
            <dd className="text-sm">
              <Link href={`/assets/${issue.asset.id}`} className="text-brand hover:underline">{issue.asset.name}</Link>
              <span className="ml-1 text-slate-400">· {issue.asset.status.toLowerCase()}</span>
            </dd>
          </div>
        ) : null}
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{issue.description}</p>
        {issue.photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {issue.photos.map((p) => (
              <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- tenant-scoped private route */}
                <img src={`/api/photos/${p.id}`} alt="Issue photo" className="aspect-square w-full rounded-lg object-cover" />
              </a>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Owner</div>
            <div className="mt-1 w-56">
              <IssueAssignee issueId={issue.id} current={issue.assignedTo?.id ?? null} users={users} />
            </div>
          </div>
          {assets.length > 0 ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Asset</div>
              <div className="mt-1 w-56">
                <IssueAssetLink issueId={issue.id} current={issue.asset?.id ?? null} assets={assets} />
              </div>
            </div>
          ) : null}
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Move to</div>
            <IssueStatusBar issueId={issue.id} status={issue.status} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Notes & activity</h2>
        <div className="mb-4">
          <IssueCommentBox issueId={issue.id} />
        </div>
        <ul className="space-y-2">
          {issue.comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-800">{c.body}</div>
              <div className="mt-1 text-xs text-slate-400">
                {c.author.name} · {DateTime.fromJSDate(c.createdAt, { zone: tz }).toFormat("MMM d, h:mm a")}
              </div>
            </li>
          ))}
          {activity.map((a) => (
            <li key={a.id} className="px-1 text-xs text-slate-500">
              {lifecycleLabel(a.action, a.newValue)} ·{" "}
              {DateTime.fromJSDate(a.createdAt, { zone: tz }).toFormat("MMM d, h:mm a")}
            </li>
          ))}
          {issue.comments.length === 0 && activity.length === 0 ? (
            <li className="text-sm text-slate-400">No activity yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  )
}

// Human labels for the full issue lifecycle, all drawn from the one AuditEvent
// stream (Phase 34) — report → route → assign/reassign → status → resolve →
// verify → reopen → escalate → asset link → comment.
function lifecycleLabel(action: string, newValue: string | null): string {
  switch (action) {
    case "report": return "Reported"
    case "route": return newValue ? "Auto-routed to an owner" : "Auto-routed (left unassigned)"
    case "assign": return "Assigned to an owner"
    case "reassign": return "Reassigned"
    case "status": return `Status → ${newValue}`
    case "reopen": return "Reopened"
    case "verify": return "Verified & closed"
    case "escalate": return "Escalated"
    case "comment": return "Note added"
    case "link-asset": return "Linked to an asset"
    case "unlink-asset": return "Asset unlinked"
    default: return action
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}
