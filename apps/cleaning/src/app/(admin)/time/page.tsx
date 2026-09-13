import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canApproveTime } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listTimeEntries } from "@/lib/data/time-entries"
import { getOrgTimezone } from "@/lib/data/org"
import { formatTimeInZone } from "@/lib/scheduling/time"
import Link from "next/link"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge } from "@/components/ui/controls"
import { ClockIcon } from "@/components/ui/icons"
import { ApproveButton, CorrectButton } from "@/components/time/time-actions"
import { ExportBar } from "@/components/time/export-bar"

export const dynamic = "force-dynamic"
const CAP = "workforce.timeTracking"

function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export default async function TimePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
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
  const canApprove = canApproveTime(session.role)
  const tz = await getOrgTimezone(orgId)
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 86_400_000)
  const end = new Date(now.getTime() + 86_400_000)
  const all = await listTimeEntries(orgId, start, end)
  const pending = all.filter((e) => e.status === "COMPLETED").length

  const { status } = await searchParams
  const pendingOnly = status === "pending"
  const entries = pendingOnly ? all.filter((e) => e.status === "COMPLETED") : all

  return (
    <div>
      <PageHeader
        title="Time"
        subtitle={`Labor records — last 30 days${pending ? ` · ${pending} awaiting approval` : ""}. Not payroll.`}
        action={canApprove ? <ExportBar /> : undefined}
      />

      {pendingOnly ? (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            Awaiting approval
            <Link href="/time" className="text-amber-700 hover:text-amber-900" aria-label="Clear filter">
              ✕
            </Link>
          </span>
        </div>
      ) : null}

      {entries.length === 0 ? (
        pendingOnly ? (
          <EmptyState
            icon={<ClockIcon />}
            title="Nothing awaiting approval"
            description="All submitted time has been approved."
            actionLabel="View all time"
            actionHref="/time"
          />
        ) : (
          <EmptyState
            icon={<ClockIcon />}
            title="No time entries yet"
            description="Time records appear here automatically once cleaners clock in and out on their jobs."
            actionLabel="View schedule"
            actionHref="/schedule"
          />
        )
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
                {canApprove ? <th className="px-4 py-2.5 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((t) => {
                const etz = t.job?.serviceLocation?.timezone ?? tz
                const located = t.clockInLat != null && t.clockInLng != null
                const canActOnRow = canApprove && t.clockOutAt != null
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
                    <td className="px-4 py-3">
                      <StatusBadge tone={t.status === "APPROVED" ? "success" : t.status === "COMPLETED" ? "warning" : "neutral"}>
                        {t.status === "COMPLETED" ? "Pending" : t.status === "APPROVED" ? "Approved" : "Open"}
                      </StatusBadge>
                    </td>
                    {canApprove ? (
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {t.status === "COMPLETED" ? <ApproveButton entryId={t.id} /> : null}
                          {canActOnRow ? (
                            <CorrectButton
                              entryId={t.id}
                              tz={etz}
                              clockInIso={t.clockInAt.toISOString()}
                              clockOutIso={t.clockOutAt ? t.clockOutAt.toISOString() : null}
                            />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
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
