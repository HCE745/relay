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
import { NewJobButton } from "@/components/jobs/new-job-button"
import { ScheduleCalendar, type CalJob } from "@/components/schedule/schedule-calendar"

export const dynamic = "force-dynamic"
const CAP = "core.scheduling"
type View = "week" | "day" | "month"

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; week?: string }> }) {
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
  const sp = await searchParams
  const view: View = sp.view === "day" || sp.view === "month" ? sp.view : "week"
  const dateParam = sp.date ?? sp.week
  const anchor = dateParam ? DateTime.fromISO(dateParam, { zone: tz }) : DateTime.now().setZone(tz)

  // Window per view. Luxon weeks are Monday-start.
  let firstDay: DateTime
  let lastDay: DateTime
  let monthAnchor: DateTime | null = null
  if (view === "day") {
    firstDay = anchor.startOf("day")
    lastDay = anchor.startOf("day")
  } else if (view === "month") {
    monthAnchor = anchor.startOf("month")
    firstDay = monthAnchor.startOf("week")
    lastDay = monthAnchor.endOf("month").endOf("week").startOf("day")
  } else {
    firstDay = anchor.startOf("week")
    lastDay = firstDay.plus({ days: 6 })
  }

  const dayCount = Math.round(lastDay.diff(firstDay, "days").days) + 1
  const dayList = Array.from({ length: dayCount }, (_, i) => firstDay.plus({ days: i }))
  const visibleKeys = new Set(dayList.map((d) => d.toFormat("yyyy-MM-dd")))

  const canManage = canManageSchedule(session.role)
  // Pad the fetch window ±1 day so site-local bucketing never drops boundary jobs.
  const [jobs, sites, templates] = await Promise.all([
    listJobsInWindow(orgId, firstDay.minus({ days: 1 }).toJSDate(), lastDay.plus({ days: 2 }).toJSDate()),
    canManage ? listAllSites(orgId) : Promise.resolve([]),
    canManage ? listChecklistTemplates(orgId) : Promise.resolve([]),
  ])

  // Precompute every block's position in the SITE's local timezone via the
  // existing scheduler helpers — no second timezone path.
  const calJobs: CalJob[] = []
  for (const job of jobs) {
    const jtz = job.serviceLocation.timezone ?? tz
    const dayKey = dateKeyInZone(job.scheduledStart, jtz)
    if (!visibleKeys.has(dayKey)) continue
    const start = DateTime.fromJSDate(job.scheduledStart, { zone: jtz })
    const endDt = job.scheduledEnd ? DateTime.fromJSDate(job.scheduledEnd, { zone: jtz }) : start.plus({ minutes: 60 })
    const startMin = start.hour * 60 + start.minute
    // Clamp same-day; overnight jobs end at midnight for layout purposes.
    let endMin = endDt.hasSame(start, "day") ? endDt.hour * 60 + endDt.minute : 24 * 60
    if (endMin <= startMin) endMin = Math.min(24 * 60, startMin + 30)
    const cleaners = job.assignments.map((a) => a.user.name)
    const cleanerIds = job.assignments.map((a) => a.user.id)
    calJobs.push({
      id: job.id,
      status: job.status,
      customerName: job.serviceLocation.customer.name,
      siteName: job.serviceLocation.name,
      siteId: job.serviceLocation.id,
      customerId: job.serviceLocation.customerId,
      timeLabel: formatTimeInZone(job.scheduledStart, jtz),
      endLabel: formatTimeInZone(endDt.toJSDate(), jtz),
      dayKey,
      startMin,
      endMin,
      cleaners,
      cleanerIds,
      crewSize: job.crewSize ?? null,
      unassigned: job.assignments.length === 0,
      understaffed: job.crewSize != null && job.assignments.length > 0 && job.assignments.length < job.crewSize,
    })
  }

  // Time-grid bounds (week/day): frame the day, expand to fit early/late work.
  const starts = calJobs.map((j) => j.startMin)
  const ends = calJobs.map((j) => j.endMin)
  const startHour = Math.max(0, Math.min(7, starts.length ? Math.floor(Math.min(...starts) / 60) : 7))
  const endHour = Math.min(24, Math.max(19, ends.length ? Math.ceil(Math.max(...ends) / 60) : 19))

  // Filter option lists derived from the loaded window.
  const cleanerMap = new Map<string, string>()
  const customerMap = new Map<string, string>()
  for (const j of calJobs) {
    j.cleanerIds.forEach((id, i) => cleanerMap.set(id, j.cleaners[i]))
    customerMap.set(j.customerId, j.customerName)
  }
  const cleaners = [...cleanerMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  const customers = [...customerMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  const days = dayList.map((d) => ({
    key: d.toFormat("yyyy-MM-dd"),
    weekday: d.toFormat("ccc"),
    dayNum: d.toFormat("d"),
    inRange: view === "month" && monthAnchor ? d.hasSame(monthAnchor, "month") : true,
  }))

  // Navigation hrefs + range label per view.
  const base = "/schedule"
  const dateOf = view === "month" && monthAnchor ? monthAnchor : firstDay
  const dp = dateOf.toFormat("yyyy-MM-dd")
  const step = (dt: DateTime) => `${base}?view=${view}&date=${dt.toFormat("yyyy-MM-dd")}`
  const prevDt = view === "day" ? firstDay.minus({ days: 1 }) : view === "month" ? dateOf.minus({ months: 1 }) : firstDay.minus({ days: 7 })
  const nextDt = view === "day" ? firstDay.plus({ days: 1 }) : view === "month" ? dateOf.plus({ months: 1 }) : firstDay.plus({ days: 7 })
  const rangeLabel =
    view === "day"
      ? anchor.toFormat("cccc, MMM d, yyyy")
      : view === "month" && monthAnchor
        ? monthAnchor.toFormat("MMMM yyyy")
        : `${firstDay.toFormat("MMM d")} – ${lastDay.toFormat("MMM d, yyyy")}`

  const newJob = canManage ? (
    <NewJobButton sites={sites.map((s) => ({ id: s.id, name: s.name }))} templates={templates.map((t) => ({ id: t.id, name: t.name }))} />
  ) : null

  return (
    <div>
      <PageHeader title="Schedule" subtitle="Plan the week, spot unassigned work at a glance" />
      <ScheduleCalendar
        view={view}
        jobs={calJobs}
        days={days}
        todayKey={DateTime.now().setZone(tz).toFormat("yyyy-MM-dd")}
        startHour={startHour}
        endHour={endHour}
        cleaners={cleaners}
        customers={customers}
        nav={{
          prevHref: step(prevDt),
          nextHref: step(nextDt),
          todayHref: `${base}?view=${view}`,
          weekHref: `${base}?view=week&date=${dp}`,
          dayHref: `${base}?view=day&date=${dp}`,
          monthHref: `${base}?view=month&date=${dp}`,
          rangeLabel,
        }}
        newJob={newJob}
      />
    </div>
  )
}
