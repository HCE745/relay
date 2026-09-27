"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { jobStatusStyle, JOB_STATUS, JOB_STATUS_ORDER } from "@/components/jobs/job-status"

export type CalJob = {
  id: string
  status: string
  customerName: string
  siteName: string
  siteId: string
  customerId: string
  timeLabel: string
  endLabel: string
  dayKey: string
  startMin: number
  endMin: number
  cleaners: string[]
  cleanerIds: string[]
  crewSize: number | null
  unassigned: boolean
  understaffed: boolean
}

export type CalendarNav = {
  prevHref: string
  nextHref: string
  todayHref: string
  weekHref: string
  dayHref: string
  monthHref: string
  rangeLabel: string
}

type Props = {
  view: "week" | "day" | "month"
  jobs: CalJob[]
  days: { key: string; weekday: string; dayNum: string; inRange: boolean }[]
  todayKey: string
  startHour: number
  endHour: number
  cleaners: { id: string; name: string }[]
  customers: { id: string; name: string }[]
  nav: CalendarNav
  newJob: React.ReactNode | null
}

const HOUR_PX = 52
const to12h = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`

// Lane-pack overlapping jobs within a day so concurrent blocks sit side by side.
function packLanes(dayJobs: CalJob[]) {
  const sorted = [...dayJobs].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const out: { job: CalJob; lane: number; laneCount: number }[] = []
  let cluster: CalJob[] = []
  let clusterEnd = -1
  const flush = () => {
    const laneEnds: number[] = []
    const placed = cluster.map((j) => {
      let lane = laneEnds.findIndex((end) => end <= j.startMin)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(j.endMin)
      } else {
        laneEnds[lane] = j.endMin
      }
      return { job: j, lane }
    })
    const laneCount = laneEnds.length || 1
    for (const p of placed) out.push({ ...p, laneCount })
    cluster = []
    clusterEnd = -1
  }
  for (const j of sorted) {
    if (cluster.length && j.startMin >= clusterEnd) flush()
    cluster.push(j)
    clusterEnd = Math.max(clusterEnd, j.endMin)
  }
  if (cluster.length) flush()
  return out
}

export function ScheduleCalendar(props: Props) {
  const { view, jobs, days, todayKey, startHour, endHour, cleaners, customers, nav, newJob } = props
  const router = useRouter()
  const [cleanerFilter, setCleanerFilter] = useState("all")
  const [customerFilter, setCustomerFilter] = useState("all")

  const shown = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (customerFilter === "all" || j.customerId === customerFilter) &&
          (cleanerFilter === "all" || (cleanerFilter === "unassigned" ? j.unassigned : j.cleanerIds.includes(cleanerFilter))),
      ),
    [jobs, cleanerFilter, customerFilter],
  )

  const byDay = useMemo(() => {
    const m = new Map<string, CalJob[]>()
    for (const j of shown) (m.get(j.dayKey) ?? m.set(j.dayKey, []).get(j.dayKey)!).push(j)
    return m
  }, [shown])

  const unassignedCount = shown.filter((j) => j.unassigned).length
  const filterSelect = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
  const navBtn = "inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            {(["week", "day", "month"] as const).map((v) => {
              const href = v === "week" ? nav.weekHref : v === "day" ? nav.dayHref : nav.monthHref
              const active = v === view
              return (
                <Link
                  key={v}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {v}
                </Link>
              )
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <Link href={nav.prevHref} className={navBtn} aria-label="Previous">←</Link>
            <Link href={nav.todayHref} className={navBtn}>Today</Link>
            <Link href={nav.nextHref} className={navBtn} aria-label="Next">→</Link>
          </div>
          <span className="ml-1 text-sm font-semibold text-slate-800">{nav.rangeLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={cleanerFilter} onChange={(e) => setCleanerFilter(e.target.value)} className={filterSelect} aria-label="Filter by cleaner">
            <option value="all">All cleaners</option>
            <option value="unassigned">Unassigned only</option>
            {cleaners.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={filterSelect} aria-label="Filter by customer">
            <option value="all">All customers</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          {newJob}
        </div>
      </div>

      {/* Legend + unassigned callout */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        {JOB_STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${JOB_STATUS[s].dot}`} />
            {JOB_STATUS[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-orange-200" />
          Unassigned
        </span>
        {unassignedCount > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
            {unassignedCount} unassigned job{unassignedCount === 1 ? "" : "s"} — needs attention
          </span>
        ) : (
          <span className="ml-auto text-xs text-slate-400">All jobs assigned</span>
        )}
      </div>

      {view === "month" ? (
        <MonthGrid days={days} byDay={byDay} todayKey={todayKey} router={router} />
      ) : (
        <TimeGrid view={view} days={days} byDay={byDay} todayKey={todayKey} startHour={startHour} endHour={endHour} router={router} />
      )}
    </div>
  )
}

function JobBlockBody({ job, compact }: { job: CalJob; compact?: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold opacity-80">{job.timeLabel}</span>
        {job.understaffed ? <span className="shrink-0 rounded bg-orange-200 px-1 text-[10px] font-bold text-orange-900">{job.cleaners.length}/{job.crewSize}</span> : null}
      </div>
      <div className="truncate text-[13px] font-semibold leading-tight">{job.customerName}</div>
      {!compact ? <div className="truncate text-[11px] opacity-70">{job.siteName}</div> : null}
      {job.unassigned ? (
        <div className="mt-0.5 truncate text-[11px] font-bold text-orange-800">⚠ Unassigned</div>
      ) : (
        <div className="truncate text-[11px] opacity-75">{job.cleaners.join(", ")}</div>
      )}
    </>
  )
}

function blockClasses(job: CalJob) {
  if (job.unassigned) return "border-2 border-orange-400 bg-orange-100 text-orange-950 ring-1 ring-orange-300"
  const s = jobStatusStyle(job.status)
  return `border ${s.block} ${job.understaffed ? "ring-2 ring-orange-300" : ""}`
}

function TimeGrid({
  view,
  days,
  byDay,
  todayKey,
  startHour,
  endHour,
  router,
}: {
  view: "week" | "day"
  days: Props["days"]
  byDay: Map<string, CalJob[]>
  todayKey: string
  startHour: number
  endHour: number
  router: ReturnType<typeof useRouter>
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const gridHeight = (endHour - startHour) * HOUR_PX
  const cols = view === "day" ? days.filter((d) => d.inRange) : days
  const minColWidth = view === "day" ? 0 : 132

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-fit">
        {/* Header row */}
        <div className="flex border-b border-slate-200" style={{ minWidth: view === "week" ? cols.length * minColWidth + 56 : undefined }}>
          <div className="w-14 shrink-0" />
          {cols.map((d) => {
            const isToday = d.key === todayKey
            return (
              <div key={d.key} className="flex-1 border-l border-slate-100 px-2 py-2 text-center" style={{ minWidth: minColWidth || undefined }}>
                <div className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-brand" : "text-slate-400"}`}>{d.weekday}</div>
                <div className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-brand text-white" : "text-slate-700"}`}>{d.dayNum}</div>
              </div>
            )
          })}
        </div>
        {/* Body */}
        <div className="flex" style={{ minWidth: view === "week" ? cols.length * minColWidth + 56 : undefined }}>
          {/* Hour gutter */}
          <div className="w-14 shrink-0">
            {hours.map((h) => (
              <div key={h} className="relative border-b border-slate-50" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 right-2 text-[10px] text-slate-400">{to12h(h)}</span>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {cols.map((d) => {
            const packed = packLanes(byDay.get(d.key) ?? [])
            return (
              <div key={d.key} className="relative flex-1 border-l border-slate-100" style={{ height: gridHeight, minWidth: minColWidth || undefined }}>
                {hours.map((h) => (<div key={h} className="border-b border-slate-50" style={{ height: HOUR_PX }} />))}
                {packed.map(({ job, lane, laneCount }) => {
                  const top = Math.max(0, ((job.startMin - startHour * 60) / 60) * HOUR_PX)
                  const rawH = ((job.endMin - job.startMin) / 60) * HOUR_PX
                  const height = Math.max(24, Math.min(rawH, gridHeight - top))
                  const widthPct = 100 / laneCount
                  return (
                    <button
                      key={job.id}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className={`absolute overflow-hidden rounded-lg px-2 py-1 text-left shadow-sm transition hover:z-10 hover:shadow-md ${blockClasses(job)}`}
                      style={{ top, height, left: `calc(${lane * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                    >
                      <JobBlockBody job={job} compact={height < 52 || laneCount > 1} />
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthGrid({
  days,
  byDay,
  todayKey,
  router,
}: {
  days: Props["days"]
  byDay: Map<string, CalJob[]>
  todayKey: string
  router: ReturnType<typeof useRouter>
}) {
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAYS.map((w) => (<div key={w} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">{w}</div>))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dayJobs = (byDay.get(d.key) ?? []).sort((a, b) => a.startMin - b.startMin)
          const isToday = d.key === todayKey
          const shownJobs = dayJobs.slice(0, 4)
          return (
            <div key={d.key} className={`min-h-28 border-b border-l border-slate-100 p-1.5 ${d.inRange ? "bg-white" : "bg-slate-50/60"}`}>
              <div className="mb-1 flex justify-end">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-brand text-white" : d.inRange ? "text-slate-600" : "text-slate-300"}`}>{d.dayNum}</span>
              </div>
              <div className="space-y-1">
                {shownJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className={`flex w-full items-center gap-1 overflow-hidden rounded-md px-1.5 py-1 text-left ${blockClasses(job)}`}
                  >
                    {job.unassigned ? <span className="shrink-0 text-[10px] font-bold">⚠</span> : <span className={`h-2 w-2 shrink-0 rounded-full ${jobStatusStyle(job.status).dot}`} />}
                    <span className="truncate text-[11px] font-medium">{job.customerName}</span>
                  </button>
                ))}
                {dayJobs.length > shownJobs.length ? (
                  <div className="px-1 text-[10px] font-medium text-slate-400">+{dayJobs.length - shownJobs.length} more</div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
