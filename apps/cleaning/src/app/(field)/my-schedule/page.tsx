import Link from "next/link"
import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { listCleanerJobsInWindow } from "@/lib/data/field"
import { getOrgTimezone } from "@/lib/data/org"
import { formatTimeInZone } from "@/lib/scheduling/time"

export const dynamic = "force-dynamic"

export default async function MySchedulePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const now = DateTime.now().setZone(tz)
  const start = now.startOf("day").toJSDate()
  const end = now.plus({ days: 14 }).endOf("day").toJSDate()
  const jobs = await listCleanerJobsInWindow(orgId, session.userId, start, end)

  // Group by day key for a simple agenda view.
  const byDay = new Map<string, typeof jobs>()
  for (const j of jobs) {
    const key = DateTime.fromJSDate(j.scheduledStart, { zone: j.serviceLocation.timezone ?? tz }).toFormat("yyyy-LL-dd")
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(j)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My schedule</h1>
        <p className="mt-0.5 text-sm text-slate-500">Next 14 days</p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing scheduled</p>
          <p className="mt-1 text-sm text-slate-500">You have no assigned jobs in the next two weeks.</p>
        </div>
      ) : (
        [...byDay.entries()].map(([key, dayJobs]) => {
          const d = DateTime.fromISO(key, { zone: tz })
          return (
            <section key={key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {d.hasSame(now, "day") ? "Today" : d.hasSame(now.plus({ days: 1 }), "day") ? "Tomorrow" : d.toFormat("cccc, LLL d")}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {dayJobs.map((j) => {
                  const jtz = j.serviceLocation.timezone ?? tz
                  const done = j.checklistItems.filter((c) => c.isComplete).length
                  return (
                    <Link key={j.id} href={`/job/${j.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-slate-900">{formatTimeInZone(j.scheduledStart, jtz)}</span>
                        <span className="text-xs text-slate-400">{j.checklistItems.length ? `${done}/${j.checklistItems.length}` : ""}</span>
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{j.serviceLocation.customer.name}</div>
                      <div className="text-sm text-slate-500">{j.serviceLocation.name}</div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
