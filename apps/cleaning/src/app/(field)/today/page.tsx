import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { listCleanerDayJobs } from "@/lib/data/field"
import { getOrgTimezone } from "@/lib/data/org"
import { formatTimeInZone } from "@/lib/scheduling/time"

export const dynamic = "force-dynamic"

type Job = Awaited<ReturnType<typeof listCleanerDayJobs>>[number]

function progress(job: Job) {
  const items = job.checklistItems
  const done = items.filter((i) => i.isComplete).length
  return { done, total: items.length }
}

function JobCard({ job, tz }: { job: Job; tz: string }) {
  const jtz = job.serviceLocation.timezone ?? tz
  const p = progress(job)
  const clockedIn = job.timeEntries.length > 0
  return (
    <Link href={`/job/${job.id}`}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-slate-900">{formatTimeInZone(job.scheduledStart, jtz)}</span>
          {clockedIn ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Clocked in</span>
          ) : null}
        </div>
        <div className="mt-1 text-base font-medium text-slate-900">{job.serviceLocation.customer.name}</div>
        <div className="text-sm text-slate-500">{job.serviceLocation.name}</div>
        {[job.serviceLocation.addressLine1, job.serviceLocation.city, job.serviceLocation.state].filter(Boolean).length ? (
          <div className="mt-1 text-sm text-slate-400">
            {[job.serviceLocation.addressLine1, job.serviceLocation.city, job.serviceLocation.state].filter(Boolean).join(", ")}
          </div>
        ) : null}
        {p.total > 0 ? (
          <div className="mt-2 text-xs font-medium text-slate-500">
            Checklist {p.done}/{p.total}
          </div>
        ) : null}
      </div>
    </Link>
  )
}

export default async function TodayPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const now = DateTime.now().setZone(tz)
  const dayStart = now.startOf("day").toJSDate()
  const dayEnd = now.endOf("day").toJSDate()

  const jobs = await listCleanerDayJobs(orgId, session.userId, dayStart, dayEnd)
  const inProgress = jobs.filter((j) => j.status === "IN_PROGRESS")
  const completed = jobs.filter((j) => j.status === "COMPLETED")
  const upcoming = jobs.filter((j) => j.status === "SCHEDULED" || j.status === "ASSIGNED")

  const Section = ({ title, list }: { title: string; list: Job[] }) =>
    list.length ? (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
        {list.map((j) => (
          <JobCard key={j.id} job={j} tz={tz} />
        ))}
      </section>
    ) : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Today&apos;s Work</h1>
        <p className="mt-0.5 text-sm text-slate-500">{now.toFormat("cccc, LLLL d")}</p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">No jobs assigned today</p>
          <p className="mt-1 text-sm text-slate-500">Check back later or contact your supervisor.</p>
        </div>
      ) : (
        <>
          <Section title="In progress" list={inProgress} />
          <Section title="Upcoming" list={upcoming} />
          <Section title="Completed today" list={completed} />
        </>
      )}
    </div>
  )
}
