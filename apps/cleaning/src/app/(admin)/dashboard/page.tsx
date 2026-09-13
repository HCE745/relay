import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { getOrgTimezone } from "@/lib/data/org"
import { getDashboardMetrics } from "@/lib/data/dashboard"
import { getSetupProgress } from "@/lib/data/setup"
import { isSetupGuideDismissed } from "@/lib/setup-actions"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { SetupChecklist } from "@/components/dashboard/setup-checklist"

export const dynamic = "force-dynamic"

type Tile = { label: string; value: number; href: string; alert: boolean }

function MetricTile({ t }: { t: Tile }) {
  const alerting = t.alert && t.value > 0
  return (
    <Link key={t.label} href={t.href}>
      <Card
        className={`p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
          alerting ? "border-orange-300 bg-orange-50/50 hover:border-orange-400" : "hover:border-brand"
        }`}
      >
        <p className="text-sm font-medium text-slate-600">{t.label}</p>
        <p className={`mt-2 text-3xl font-semibold ${alerting ? "text-orange-600" : "text-slate-900"}`}>{t.value}</p>
      </Card>
    </Link>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const m = await getDashboardMetrics(orgId, tz)

  // Setup guide: only for users who can act on it, only until complete/dismissed.
  const canSetup = canManageAccounts(session.role)
  const [progress, dismissed] = canSetup
    ? await Promise.all([getSetupProgress(orgId), isSetupGuideDismissed()])
    : [null, true]
  const showSetup = canSetup && progress != null && !progress.allComplete && !dismissed

  const needsAttention: Tile[] = [
    { label: "Unassigned", value: m.unassigned, href: "/jobs?f=unassigned-today", alert: true },
    { label: "Understaffed", value: m.understaffed, href: "/jobs?f=understaffed-today", alert: true },
    { label: "Awaiting inspection", value: m.awaitingInspection, href: "/jobs?f=awaiting-inspection", alert: true },
    { label: "Failed inspections", value: m.failedInspections, href: "/inspections?outcome=FAIL", alert: true },
    { label: "Open problems", value: m.openIssues, href: "/issues?status=OPEN", alert: true },
    { label: "Time to approve", value: m.pendingApproval, href: "/time?status=pending", alert: true },
  ]
  const overview: Tile[] = [
    { label: "Scheduled today", value: m.scheduledToday, href: "/jobs?f=scheduled-today", alert: false },
    { label: "In progress", value: m.inProgress, href: "/jobs?f=in-progress", alert: false },
    { label: "Completed today", value: m.completedToday, href: "/jobs?f=completed-today", alert: false },
  ]

  const attentionCount = needsAttention.filter((t) => t.value > 0).length

  return (
    <div>
      <PageHeader
        title={session.role === "SUPERVISOR" ? "Supervisor Dashboard" : "Dashboard"}
        subtitle={`What needs attention today · ${session.name}`}
      />

      {showSetup ? <SetupChecklist progress={progress} /> : null}

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Needs attention</h2>
          {attentionCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
              {attentionCount}
            </span>
          ) : (
            <span className="text-xs text-slate-400">All clear</span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {needsAttention.map((t) => (
            <MetricTile key={t.label} t={t} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Today at a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overview.map((t) => (
            <MetricTile key={t.label} t={t} />
          ))}
        </div>
      </section>
    </div>
  )
}
