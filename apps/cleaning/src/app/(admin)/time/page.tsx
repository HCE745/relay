import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listTimeEntries } from "@/lib/data/time-entries"
import { getOrgTimezone } from "@/lib/data/org"
import { formatTimeInZone } from "@/lib/scheduling/time"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"

export const dynamic = "force-dynamic"
const CAP = "workforce.timeTracking"

function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export default async function TimePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Time" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 86_400_000)
  const end = new Date(now.getTime() + 86_400_000)
  const entries = await listTimeEntries(orgId, start, end)

  return (
    <div>
      <PageHeader title="Time" subtitle="Labor & time records — last 30 days. Approval and payroll export arrive later." />
      {entries.length === 0 ? (
        <EmptyState title="No time entries yet">Time appears here once cleaners start clocking in.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Job / Site</th>
                <th className="px-4 py-2.5 font-medium">Clock in</th>
                <th className="px-4 py-2.5 font-medium">Clock out</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
                <th className="px-4 py-2.5 font-medium">Loc</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((t) => {
                const etz = t.job?.serviceLocation?.timezone ?? tz
                const located = t.clockInLat != null && t.clockInLng != null
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{t.user.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{t.job?.serviceLocation?.customer?.name ?? "—"}</div>
                      <div className="text-xs text-slate-400">{t.job?.serviceLocation?.name ?? t.job?.title ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {DateTime.fromJSDate(t.clockInAt, { zone: etz }).toFormat("MMM d")} · {formatTimeInZone(t.clockInAt, etz)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.clockOutAt ? formatTimeInZone(t.clockOutAt, etz) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.clockOutAt ? fmtDuration(t.clockOutAt.getTime() - t.clockInAt.getTime()) : "open"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${located ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {located ? "GPS" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
