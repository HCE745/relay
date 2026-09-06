import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listJobsInWindow } from "@/lib/data/jobs"
import { listAllSites } from "@/lib/data/service-locations"
import { listChecklistTemplates } from "@/lib/data/checklist-templates"
import { getOrgTimezone } from "@/lib/data/org"
import { formatTimeInZone, dateKeyInZone } from "@/lib/scheduling/time"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { JobStatusBadge, UnassignedBadge } from "@/components/jobs/job-status"
import { NewJobButton } from "@/components/jobs/new-job-button"

export const dynamic = "force-dynamic"
const CAP = "core.scheduling"

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Schedule" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const { week } = await searchParams

  const anchor = week ? DateTime.fromISO(week, { zone: tz }) : DateTime.now().setZone(tz)
  const weekStart = anchor.startOf("week") // Monday
  const weekEnd = weekStart.plus({ days: 7 })

  const canManage = canManageSchedule(session.role)
  const [jobs, sites, templates] = await Promise.all([
    listJobsInWindow(orgId, weekStart.toJSDate(), weekEnd.toJSDate()),
    canManage ? listAllSites(orgId) : Promise.resolve([]),
    canManage ? listChecklistTemplates(orgId) : Promise.resolve([]),
  ])

  // Group by site-local day (falling back to org tz).
  const byDay = new Map<string, typeof jobs>()
  for (const job of jobs) {
    const jtz = job.serviceLocation.timezone ?? tz
    const key = dateKeyInZone(job.scheduledStart, jtz)
    ;(byDay.get(key) ?? byDay.set(key, []).get(key)!).push(job)
  }

  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }))
  const prev = weekStart.minus({ days: 7 }).toFormat("yyyy-MM-dd")
  const next = weekStart.plus({ days: 7 }).toFormat("yyyy-MM-dd")

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Schedule"
          subtitle={`Week of ${weekStart.toFormat("MMM d")} – ${weekStart.plus({ days: 6 }).toFormat("MMM d, yyyy")}`}
        />
        <div className="flex items-center gap-2">
          <Link href={`/schedule?week=${prev}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            ← Prev
          </Link>
          <Link href="/schedule" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            Today
          </Link>
          <Link href={`/schedule?week=${next}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            Next →
          </Link>
          {canManage ? <NewJobButton sites={sites.map((s) => ({ id: s.id, name: s.name }))} templates={templates.map((t) => ({ id: t.id, name: t.name }))} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const key = day.toFormat("yyyy-MM-dd")
          const dayJobs = byDay.get(key) ?? []
          const isToday = key === DateTime.now().setZone(tz).toFormat("yyyy-MM-dd")
          return (
            <div key={key} className="min-h-32">
              <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${isToday ? "text-brand" : "text-slate-400"}`}>
                {day.toFormat("ccc")} <span className="text-slate-300">{day.toFormat("MMM d")}</span>
              </div>
              <div className="space-y-2">
                {dayJobs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-xs text-slate-300">—</div>
                ) : (
                  dayJobs.map((job) => {
                    const jtz = job.serviceLocation.timezone ?? tz
                    return (
                      <Link key={job.id} href={`/jobs/${job.id}`}>
                        <Card className="p-2.5 hover:border-brand">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700">{formatTimeInZone(job.scheduledStart, jtz)}</span>
                            <JobStatusBadge status={job.status} />
                          </div>
                          <div className="mt-1 truncate text-sm font-medium text-slate-900">{job.serviceLocation.customer.name}</div>
                          <div className="truncate text-xs text-slate-500">{job.serviceLocation.name}</div>
                          <div className="mt-1.5">
                            {job.assignments.length === 0 ? (
                              <UnassignedBadge />
                            ) : (
                              <span className="text-xs text-slate-600">
                                {job.assignments.map((a) => a.user.name).join(", ")}
                              </span>
                            )}
                            {job.crewSize != null && job.assignments.length > 0 && job.assignments.length < job.crewSize ? (
                              <span className="ml-1 text-xs font-medium text-orange-600">
                                ({job.assignments.length}/{job.crewSize})
                              </span>
                            ) : null}
                          </div>
                        </Card>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
