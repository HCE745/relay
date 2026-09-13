import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listJobsInWindow, listJobsAwaitingInspection } from "@/lib/data/jobs"
import { listAllSites } from "@/lib/data/service-locations"
import { listChecklistTemplates } from "@/lib/data/checklist-templates"
import { getOrgTimezone } from "@/lib/data/org"
import { formatTimeInZone, dateKeyInZone } from "@/lib/scheduling/time"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { BriefcaseIcon } from "@/components/ui/icons"
import { JobStatusBadge, UnassignedBadge } from "@/components/jobs/job-status"
import { NewJobButton } from "@/components/jobs/new-job-button"

export const dynamic = "force-dynamic"
const CAP = "core.jobs"

const FILTER_LABELS: Record<string, string> = {
  "scheduled-today": "Scheduled today",
  "in-progress": "In progress",
  "completed-today": "Completed today",
  "unassigned-today": "Unassigned today",
  "understaffed-today": "Understaffed today",
  "awaiting-inspection": "Awaiting inspection",
}

type JobRow = Awaited<ReturnType<typeof listJobsInWindow>>[number]

function applyFilter(jobs: JobRow[], f: string | undefined, tz: string, todayKey: string): JobRow[] {
  if (!f) return jobs
  const isToday = (j: JobRow) => dateKeyInZone(j.scheduledStart, j.serviceLocation.timezone ?? tz) === todayKey
  switch (f) {
    case "scheduled-today":
      return jobs.filter((j) => isToday(j) && (j.status === "SCHEDULED" || j.status === "ASSIGNED"))
    case "in-progress":
      return jobs.filter((j) => j.status === "IN_PROGRESS")
    case "completed-today":
      return jobs.filter((j) => isToday(j) && j.status === "COMPLETED")
    case "unassigned-today":
      return jobs.filter((j) => isToday(j) && j.assignments.length === 0 && (j.status === "SCHEDULED" || j.status === "ASSIGNED"))
    case "understaffed-today":
      return jobs.filter(
        (j) =>
          isToday(j) &&
          j.crewSize != null &&
          j.assignments.length > 0 &&
          j.assignments.length < j.crewSize &&
          j.status !== "COMPLETED" &&
          j.status !== "MISSED",
      )
    default:
      return jobs
  }
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Jobs" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const { f } = await searchParams
  const activeFilter = f && FILTER_LABELS[f] ? f : undefined

  const canManage = canManageSchedule(session.role)
  const [rawJobs, sites, templates] = await Promise.all([
    activeFilter === "awaiting-inspection"
      ? listJobsAwaitingInspection(orgId)
      : listJobsInWindow(orgId, DateTime.now().setZone(tz).startOf("day").toJSDate(), new Date(Date.now() + 30 * 86_400_000)),
    canManage ? listAllSites(orgId) : Promise.resolve([]),
    canManage ? listChecklistTemplates(orgId) : Promise.resolve([]),
  ])

  const todayKey = DateTime.now().setZone(tz).toFormat("yyyy-MM-dd")
  const jobs = activeFilter === "awaiting-inspection" ? rawJobs : applyFilter(rawJobs, activeFilter, tz, todayKey)

  const newJobButton = canManage ? (
    <NewJobButton sites={sites.map((s) => ({ id: s.id, name: s.name }))} templates={templates.map((t) => ({ id: t.id, name: t.name }))} />
  ) : null

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle={activeFilter ? FILTER_LABELS[activeFilter] : "Today and the next 30 days"}
        action={newJobButton}
      />

      {activeFilter ? (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-teal-700">
            {FILTER_LABELS[activeFilter]}
            <Link href="/jobs" className="text-teal-600 hover:text-teal-800" aria-label="Clear filter">
              ✕
            </Link>
          </span>
        </div>
      ) : null}

      {jobs.length === 0 ? (
        activeFilter ? (
          <EmptyState
            icon={<BriefcaseIcon />}
            title="No jobs match this filter"
            description="Nothing here right now."
            actionLabel="View all jobs"
            actionHref="/jobs"
          />
        ) : (
          <EmptyState
            icon={<BriefcaseIcon />}
            title="No jobs scheduled"
            description="Generate jobs from a recurring service plan, or create a one-time job to get started."
            action={newJobButton ?? undefined}
            actionLabel={newJobButton ? undefined : "View schedule"}
            actionHref={newJobButton ? undefined : "/schedule"}
            secondaryLabel={newJobButton ? "Set up a service plan" : undefined}
            secondaryHref={newJobButton ? "/customers" : undefined}
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Customer / Site</th>
                <th className="px-4 py-2.5 font-medium">Cleaners</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => {
                const jtz = job.serviceLocation.timezone ?? tz
                const dt = DateTime.fromJSDate(job.scheduledStart, { zone: jtz })
                return (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="font-medium text-slate-900 hover:text-brand">
                        {dt.toFormat("EEE MMM d")} · {formatTimeInZone(job.scheduledStart, jtz)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{job.serviceLocation.customer.name}</div>
                      <div className="text-xs text-slate-500">{job.serviceLocation.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      {job.assignments.length === 0 ? (
                        <UnassignedBadge />
                      ) : (
                        <span className="text-slate-600">
                          {job.assignments.map((a) => a.user.name).join(", ")}
                          {job.crewSize != null && job.assignments.length < job.crewSize ? (
                            <span className="ml-1 text-xs font-medium text-orange-600">
                              (understaffed {job.assignments.length}/{job.crewSize})
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
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
