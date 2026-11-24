import { redirect } from "next/navigation"
import { DateTime } from "luxon"
import { getSession } from "@/lib/session"
import { listCleanerTimeEntries } from "@/lib/data/field"
import { getOrgTimezone } from "@/lib/data/org"

export const dynamic = "force-dynamic"

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800", SUBMITTED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700", REJECTED: "bg-red-100 text-red-700",
}

function hours(inAt: Date, outAt: Date | null, breakMin: number): string {
  if (!outAt) return "—"
  const mins = Math.max(0, (outAt.getTime() - inAt.getTime()) / 60000 - breakMin)
  return `${(mins / 60).toFixed(2)} h`
}

export default async function MyTimePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  const tz = await getOrgTimezone(orgId)
  const entries = await listCleanerTimeEntries(orgId, session.userId)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Clock history</h1>
        <p className="mt-0.5 text-sm text-slate-500">Your recent timekeeping</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">No time entries yet</p>
          <p className="mt-1 text-sm text-slate-500">Clock in from a job to start tracking time.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const din = DateTime.fromJSDate(e.clockInAt, { zone: tz })
            return (
              <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{din.toFormat("ccc, LLL d")}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[e.status] ?? "bg-slate-100 text-slate-600"}`}>{e.status}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {din.toFormat("h:mm a")} – {e.clockOutAt ? DateTime.fromJSDate(e.clockOutAt, { zone: tz }).toFormat("h:mm a") : "in progress"}
                  <span className="ml-2 text-slate-400">· {hours(e.clockInAt, e.clockOutAt, e.breakMinutes)}</span>
                </div>
                {e.job ? <div className="mt-0.5 text-xs text-slate-400">{e.job.serviceLocation?.customer.name ?? ""}{e.job.serviceLocation ? " · " : ""}{e.job.serviceLocation?.name ?? e.job.title}</div> : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
