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
import { formatTimeInZone } from "@/lib/scheduling/time"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { JobStatusBadge, UnassignedBadge } from "@/components/jobs/job-status"
import { NewJobButton } from "@/components/jobs/new-job-button"

export const dynamic = "force-dynamic"
const CAP = "core.jobs"

export default async function JobsPage() {
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
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 86_400_000)

  const canManage = canManageSchedule(session.role)
  const [jobs, sites, templates] = await Promise.all([
    listJobsInWindow(orgId, now, end),
    canManage ? listAllSites(orgId) : Promise.resolve([]),
    canManage ? listChecklistTemplates(orgId) : Promise.resolve([]),
  ])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Jobs" subtitle="Upcoming work — next 30 days" />
        {canManage ? <NewJobButton sites={sites.map((s) => ({ id: s.id, name: s.name }))} templates={templates.map((t) => ({ id: t.id, name: t.name }))} /> : null}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No upcoming jobs">Generate jobs from a service plan, or create a one-time job.</EmptyState>
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
