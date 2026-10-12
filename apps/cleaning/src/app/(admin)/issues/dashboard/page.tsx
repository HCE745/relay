import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getIssueResolutionStats } from "@/lib/data/issue-dashboard"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { InboxIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "operations.issues"

type Tile = { label: string; value: number; href: string; alert?: boolean }

function MetricTile({ t }: { t: Tile }) {
  const alerting = t.alert && t.value > 0
  return (
    <Link href={t.href}>
      <Card className={`p-5 transition hover:-translate-y-0.5 hover:shadow-md ${alerting ? "border-orange-300 bg-orange-50/50 hover:border-orange-400" : "hover:border-brand"}`}>
        <p className="text-sm font-medium text-slate-600">{t.label}</p>
        <p className={`mt-2 text-3xl font-semibold ${alerting ? "text-orange-600" : "text-slate-900"}`}>{t.value}</p>
      </Card>
    </Link>
  )
}

function Breakdown({ title, rows, href }: { title: string; rows: { key: string; count: number }[]; href: (k: string) => string }) {
  const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-slate-500">Nothing open.</p> : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between">
              <Link href={href(r.key)} className="text-slate-700 hover:text-brand">{titleCase(r.key)}</Link>
              <span className="font-medium tabular-nums text-slate-900">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default async function IssueDashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Issue dashboard" /><UpgradeNotice capability={CAP} /></div>)
  }

  const s = await getIssueResolutionStats(orgId)
  const fmtHrs = (h: number | null) => (h == null ? "—" : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`)

  const tiles: Tile[] = [
    { label: "Open", value: s.tiles.open, href: "/issues?status=OPEN" },
    { label: "Overdue", value: s.tiles.overdue, href: "/issues?overdue=1", alert: true },
    { label: "Unassigned", value: s.tiles.unassigned, href: "/issues?assignee=none", alert: true },
    { label: "Escalated", value: s.tiles.escalated, href: "/issues?escalated=1", alert: true },
    { label: "Awaiting verification", value: s.tiles.awaitingVerification, href: "/issues?status=RESOLVED" },
    { label: "Closed (7 days)", value: s.tiles.closed7, href: "/issues?status=CLOSED" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Issue dashboard" subtitle="Resolution health of the issue queue" icon={<InboxIcon />} />
      <div className="mb-1">
        <Link href="/issues" className="text-sm font-medium text-brand hover:underline">← Back to issues</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map((t) => <MetricTile key={t.label} t={t} />)}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Resolution speed (last 30 days)</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><dt className="text-xs uppercase tracking-wide text-slate-400">Median to resolve</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{fmtHrs(s.timing.medianResolveHrs)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-400">Median to close</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{fmtHrs(s.timing.medianCloseHrs)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-400">On-time (SLA)</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{s.timing.slaCompliancePct == null ? "—" : `${s.timing.slaCompliancePct}%`}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-slate-400">Reopened (open)</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{s.timing.reopenedOpen}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-slate-400">Based on {s.timing.closedCount} issue{s.timing.closedCount === 1 ? "" : "s"} closed in the last 30 days.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Breakdown title="Open by severity" rows={s.bySeverity} href={(k) => `/issues?severity=${k}`} />
        <Breakdown title="Open by category" rows={s.byCategory} href={(k) => `/issues?category=${k}`} />
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Open by owner</h2>
          {s.byOwner.length === 0 ? <p className="text-sm text-slate-500">Nothing assigned.</p> : (
            <ul className="space-y-1.5 text-sm">
              {s.byOwner.map((o) => (
                <li key={o.id} className="flex items-center justify-between">
                  <Link href={`/issues?assignee=${o.id}`} className="text-slate-700 hover:text-brand">{o.name}</Link>
                  <span className="font-medium tabular-nums text-slate-900">{o.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
