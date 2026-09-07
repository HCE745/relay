import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageSchedule, canInspect } from "@/lib/rbac"
import { getJob } from "@/lib/data/jobs"
import { listAssignableCleaners } from "@/lib/data/assignments"
import { listInspectionTemplates } from "@/lib/data/inspection-templates"
import { getOrgTimezone } from "@/lib/data/org"
import { orgHasCapability } from "@/lib/page-guards"
import { formatTimeInZone } from "@/lib/scheduling/time"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { JobStatusBadge } from "@/components/jobs/job-status"
import { AssignmentsPanel } from "@/components/jobs/assignments-panel"
import { JobActions } from "@/components/jobs/job-actions"
import { InspectButton } from "@/components/inspections/inspect-button"

export const dynamic = "force-dynamic"

function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")

  const { id } = await params
  const orgId = session.organizationId
  const job = await getJob(orgId, id)
  if (!job) notFound()

  const canManage = canManageSchedule(session.role)
  const inspector = canInspect(session.role)
  const [tz, cleaners, hasInspections, templates] = await Promise.all([
    getOrgTimezone(orgId),
    canManage ? listAssignableCleaners(orgId) : Promise.resolve([]),
    orgHasCapability(orgId, "quality.inspections"),
    inspector ? listInspectionTemplates(orgId) : Promise.resolve([]),
  ])
  const jtz = job.serviceLocation.timezone ?? tz
  const startDT = DateTime.fromJSDate(job.scheduledStart, { zone: jtz })

  const checklistDone = job.checklistItems.filter((i) => i.isComplete).length
  const understaffed = job.crewSize != null && job.assignments.length < job.crewSize
  const canMarkMissed = !["COMPLETED", "CANCELLED", "MISSED"].includes(job.status)
  const showInspect = inspector && hasInspections && job.status === "COMPLETED"
  const activeTemplates = templates.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/schedule" className="text-sm text-slate-500 hover:text-brand">
          ← Schedule
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <PageHeader title={job.title} subtitle={`${job.serviceLocation.customer.name} · ${job.serviceLocation.name}`} />
          <div className="flex flex-wrap items-center gap-3">
            <JobStatusBadge status={job.status} />
            {showInspect ? <InspectButton jobId={job.id} templates={activeTemplates} /> : null}
            {canManage ? (
              <JobActions
                jobId={job.id}
                cancelled={job.status === "CANCELLED"}
                canMarkMissed={canMarkMissed}
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
        {understaffed ? (
          <div className="mt-2 inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">
            Understaffed: {job.assignments.length} of {job.crewSize} assigned
          </div>
        ) : null}
      </div>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Detail label="Scheduled" value={`${startDT.toFormat("cccc, MMM d")} · ${formatTimeInZone(job.scheduledStart, jtz)} (${jtz})`} />
        <Detail label="Ends (scheduled)" value={job.scheduledEnd ? formatTimeInZone(job.scheduledEnd, jtz) : "—"} />
        <Detail label="Actual start" value={job.actualStart ? formatTimeInZone(job.actualStart, jtz) : "—"} />
        <Detail label="Actual end" value={job.actualEnd ? formatTimeInZone(job.actualEnd, jtz) : "—"} />
        <Detail label="Crew size" value={job.crewSize ? String(job.crewSize) : "—"} />
        <Detail label="Origin" value={job.servicePlan ? `Recurring · ${job.servicePlan.name}` : "One-time job"} />
        {job.notes ? <Detail label="Cleaner / job note" value={job.notes} /> : null}
      </Card>

      <AssignmentsPanel
        jobId={job.id}
        assignments={job.assignments.map((a) => ({ userId: a.user.id, name: a.user.name }))}
        cleaners={cleaners}
        canManage={canManage}
      />

      {/* Time entries */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Time worked</h2>
        {job.timeEntries.length === 0 ? (
          <p className="text-sm text-slate-500">No one has clocked in yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {job.timeEntries.map((t) => {
              const dur = t.clockOutAt ? fmtDuration(t.clockOutAt.getTime() - t.clockInAt.getTime()) : "in progress"
              const located = t.clockInLat != null && t.clockInLng != null
              return (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{t.user.name}</span>
                    <span className="ml-2 text-slate-500">
                      {formatTimeInZone(t.clockInAt, jtz)}
                      {t.clockOutAt ? ` – ${formatTimeInZone(t.clockOutAt, jtz)}` : " – …"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{dur}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${located ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      title={located ? "Location captured" : "No location captured"}
                    >
                      {located ? "GPS" : "no GPS"}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Checklist progress */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Checklist</h2>
          <span className="text-xs text-slate-400">
            {checklistDone}/{job.checklistItems.length} complete
          </span>
        </div>
        {job.checklistItems.length === 0 ? (
          <p className="text-sm text-slate-500">No checklist.</p>
        ) : (
          <ol className="space-y-1.5">
            {job.checklistItems.map((it) => (
              <li key={it.id} className="flex items-center gap-2 text-sm">
                <span className={it.isComplete ? "text-emerald-600" : "text-slate-300"}>{it.isComplete ? "✓" : "○"}</span>
                <span className={it.isComplete ? "text-slate-500" : "text-slate-800"}>{it.label}</span>
                {it.requirePhoto ? (
                  <span className={`text-xs ${it.photos.length ? "text-emerald-600" : "text-orange-500"}`}>
                    {it.photos.length ? "photo ✓" : "photo pending"}
                  </span>
                ) : null}
                {it.note ? <span className="text-xs text-slate-400">“{it.note}”</span> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Proof of service */}
      {job.photos.length > 0 ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Proof of service</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {job.photos.map((p) => (
              <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- proof photos are served from our own tenant-scoped route, not optimized */}
                <img src={`/api/photos/${p.id}`} alt={p.caption ?? "Proof photo"} className="aspect-square w-full rounded-lg object-cover" />
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Inspections */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Inspections</h2>
        {job.inspections.length === 0 ? (
          <p className="text-sm text-slate-500">
            {showInspect ? "Not yet inspected — tap “Inspect work” above." : "No inspections."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {job.inspections.map((ins) => (
              <li key={ins.id} className="flex items-center justify-between py-2.5 text-sm">
                <Link href={`/inspections/${ins.id}`} className="text-slate-800 hover:text-brand">
                  {ins.templateName} · {ins.inspector.name}
                </Link>
                {ins.status === "FINALIZED" ? (
                  <span className={ins.outcome === "PASS" ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                    {ins.outcome} · {ins.score}%
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Draft</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Reported problems */}
      {job.issues.length > 0 ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Reported problems</h2>
          <ul className="space-y-2">
            {job.issues.map((iss) => (
              <li key={iss.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{iss.category}</span>
                  <span className="text-xs text-slate-500">by {iss.reportedBy.name}</span>
                </div>
                <p className="mt-1 text-sm text-slate-800">{iss.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
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
