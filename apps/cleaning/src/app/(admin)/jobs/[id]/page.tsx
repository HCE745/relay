import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageSchedule } from "@/lib/rbac"
import { getJob } from "@/lib/data/jobs"
import { listAssignableCleaners } from "@/lib/data/assignments"
import { getOrgTimezone } from "@/lib/data/org"
import { formatTimeInZone } from "@/lib/scheduling/time"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { JobStatusBadge } from "@/components/jobs/job-status"
import { AssignmentsPanel } from "@/components/jobs/assignments-panel"
import { JobActions } from "@/components/jobs/job-actions"

export const dynamic = "force-dynamic"

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")

  const { id } = await params
  const orgId = session.organizationId
  const job = await getJob(orgId, id)
  if (!job) notFound()

  const canManage = canManageSchedule(session.role)
  const [tz, cleaners] = await Promise.all([
    getOrgTimezone(orgId),
    canManage ? listAssignableCleaners(orgId) : Promise.resolve([]),
  ])
  const jtz = job.serviceLocation.timezone ?? tz
  const startDT = DateTime.fromJSDate(job.scheduledStart, { zone: jtz })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/schedule" className="text-sm text-slate-500 hover:text-brand">
          ← Schedule
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <PageHeader title={job.title} subtitle={`${job.serviceLocation.customer.name} · ${job.serviceLocation.name}`} />
          <div className="flex items-center gap-3">
            <JobStatusBadge status={job.status} />
            {canManage ? (
              <JobActions
                jobId={job.id}
                cancelled={job.status === "CANCELLED"}
                initial={{
                  title: job.title,
                  date: startDT.toFormat("yyyy-MM-dd"),
                  startTime: startDT.toFormat("HH:mm"),
                  crewSize: job.crewSize,
                  notes: job.notes,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Detail label="Date" value={startDT.toFormat("cccc, MMMM d, yyyy")} />
        <Detail label="Start time" value={`${formatTimeInZone(job.scheduledStart, jtz)} (${jtz})`} />
        <Detail
          label="Ends"
          value={job.scheduledEnd ? formatTimeInZone(job.scheduledEnd, jtz) : "—"}
        />
        <Detail label="Crew size" value={job.crewSize ? String(job.crewSize) : "—"} />
        <Detail
          label="Origin"
          value={job.servicePlan ? `Recurring plan · ${job.servicePlan.name}` : "One-time job"}
        />
        <Detail label="Site" value={job.serviceLocation.name} />
        {job.notes ? <Detail label="Notes" value={job.notes} /> : null}
      </Card>

      <AssignmentsPanel
        jobId={job.id}
        assignments={job.assignments.map((a) => ({ userId: a.user.id, name: a.user.name }))}
        cleaners={cleaners}
        canManage={canManage}
      />

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Scope of work (snapshot)</h2>
        {job.checklistItems.length === 0 ? (
          <p className="text-sm text-slate-500">No checklist attached to this job.</p>
        ) : (
          <ol className="space-y-2">
            {job.checklistItems.map((it, i) => (
              <li key={it.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm text-slate-800">
                    {it.label}
                    {!it.isRequired ? <span className="ml-2 text-xs text-slate-400">(optional)</span> : null}
                    {it.requirePhoto ? <span className="ml-2 text-xs text-brand">photo</span> : null}
                  </div>
                  {it.instructions ? <div className="text-xs text-slate-500">{it.instructions}</div> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-slate-400">
          This checklist was copied from the service plan when the job was created; later template edits do not change it.
        </p>
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-slate-800">{value}</dd>
    </div>
  )
}
