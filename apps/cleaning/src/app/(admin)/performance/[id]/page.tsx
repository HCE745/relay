import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getEmployeePerformance } from "@/lib/data/performance"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { TrendBars } from "@/components/performance/trend-bars"

export const dynamic = "force-dynamic"

export default async function EmployeePerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, "workforce.performanceAnalytics"))) redirect("/dashboard")

  const { id } = await params
  const data = await getEmployeePerformance(orgId, id)
  if (!data) notFound()
  const { user, summary, trend } = data

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/performance" className="text-sm text-slate-500 hover:text-brand">← Performance</Link>
        <PageHeader title={user.name} subtitle={`${user.role.toLowerCase()} · accountability history`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Assigned" value={String(summary.tasks.assigned)} />
        <Stat label="Completed" value={String(summary.tasks.completed)} />
        <Stat label="Completion rate" value={`${summary.completionRate}%`} />
        <Stat label="Verification pass" value={`${summary.verificationPassRate}%`} />
        <Stat label="Verified" value={String(summary.tasks.verified)} />
        <Stat label="Rejected (rework)" value={String(summary.rework)} tone={summary.rework > 0 ? "warn" : undefined} />
        <Stat label="Substantiated complaints" value={String(summary.complaints.substantiated)} tone={summary.complaints.substantiated > 0 ? "warn" : undefined} />
        <Stat label="Corrective (done/assigned)" value={`${summary.corrective.completed}/${summary.corrective.assigned}`} />
      </div>

      {summary.complaints.substantiated > 0 ? (
        <Card className="p-4 text-sm text-slate-600">
          Of {summary.complaints.substantiated} substantiated complaint(s): {summary.complaints.individual} individual,{" "}
          {summary.complaints.shared} shared responsibility. Unproven allegations are excluded.
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Trend (last 6 months)</h2>
        <TrendBars points={trend} />
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
    </Card>
  )
}
