import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getTeamPerformance } from "@/lib/data/performance"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { TrendBars } from "@/components/performance/trend-bars"

export const dynamic = "force-dynamic"

export default async function PerformancePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, "workforce.performanceAnalytics"))) redirect("/dashboard")

  const { employees, org, trend } = await getTeamPerformance(orgId)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Employee performance" subtitle="Completion, quality, rework, and substantiated findings — fair attribution applied." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Completion rate" value={`${org.completionRate}%`} />
        <Stat label="Verification pass rate" value={`${org.verificationPassRate}%`} />
        <Stat label="Rework (rejected)" value={String(org.rework)} tone={org.rework > 0 ? "warn" : undefined} />
        <Stat label="Substantiated complaints" value={String(org.substantiatedComplaints)} tone={org.substantiatedComplaints > 0 ? "warn" : undefined} />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Team trend (last 6 months)</h2>
        <TrendBars points={trend} />
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">By employee</div>
        {employees.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No task history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Assigned</th>
                  <th className="px-3 py-2 font-medium">Completion</th>
                  <th className="px-3 py-2 font-medium">Verify pass</th>
                  <th className="px-3 py-2 font-medium">Rework</th>
                  <th className="px-3 py-2 font-medium">Substantiated</th>
                  <th className="px-3 py-2 font-medium">Corrective</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{e.name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.summary.tasks.assigned}</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.summary.completionRate}%</td>
                    <td className="px-3 py-2.5 text-slate-600">{e.summary.verificationPassRate}%</td>
                    <td className={`px-3 py-2.5 ${e.summary.rework > 0 ? "text-amber-700" : "text-slate-600"}`}>{e.summary.rework}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {e.summary.complaints.substantiated}
                      {e.summary.complaints.shared > 0 ? <span className="ml-1 text-xs text-slate-400">({e.summary.complaints.shared} shared)</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{e.summary.corrective.completed}/{e.summary.corrective.assigned}</td>
                    <td className="px-3 py-2.5 text-right"><Link href={`/performance/${e.id}`} className="text-xs font-medium text-brand hover:underline">View →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="px-1 text-xs text-slate-400">
        Fair attribution: only substantiated complaints are counted; shared assignments are marked and never treated as sole fault; unproven allegations are excluded.
      </p>
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
