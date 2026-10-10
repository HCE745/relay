// READ-ONLY ghost-job detector (no deletes — reports only).
//
// Background: before fix 944043f, rescheduling a plan job moved its
// scheduledStart and the generator recreated a GHOST in the vacated slot. The
// fix's migration backfilled plannedStart = scheduledStart for all existing
// plan jobs, which erases the moved job's original slot — so a ghost can no
// longer be identified by plannedStart alone. This detector uses two signals:
//
//   SIGNAL 1 (high confidence): two or more non-cancelled jobs for the SAME
//   service plan on the SAME site-local calendar day. A recurring plan yields
//   at most one visit/day, so a same-day pair is the exact fingerprint of a
//   reschedule-within-day + regenerated ghost. (Manual jobs have servicePlanId
//   = NULL and are excluded.)
//
//   SIGNAL 2 (corroborating): per plan, compare the count of non-cancelled jobs
//   to the number of recurrence occurrences over the span of its jobs. "Excess"
//   = more jobs than the plan should ever have produced ⇒ likely ghost(s).
//   Conservative: an off-grid reschedule inflates the span and shrinks excess,
//   so this UNDER-reports rather than over-reports.
//
// Within a flagged group, a job is a GHOST CANDIDATE only if it is untouched:
// status SCHEDULED with zero assignments, zero time entries, zero photos. A job
// that was worked, assigned, or deliberately moved is marked KEEP.
//
// Usage (point at the target DB):
//   DATABASE_URL="<prod read-only url>" pnpm exec tsx scripts/detect-ghost-jobs.ts
// It only SELECTs. It never writes or deletes.

import { DateTime } from "luxon"
import { systemDb } from "../src/lib/org-db"
import { generateOccurrences, type Frequency, type PlanRecurrence } from "../src/lib/scheduling/recurrence"

type JobRow = {
  id: string
  scheduledStart: Date
  plannedStart: Date | null
  status: string
  createdAt: Date
  title: string
  tz: string
  assignments: number
  timeEntries: number
  photos: number
}

const untouched = (j: JobRow) => j.status === "SCHEDULED" && j.assignments === 0 && j.timeEntries === 0 && j.photos === 0
const localDay = (d: Date, tz: string) => DateTime.fromJSDate(d, { zone: tz || "UTC" }).toISODate()
const fmt = (d: Date, tz: string) => `${d.toISOString()} (${DateTime.fromJSDate(d, { zone: tz || "UTC" }).toFormat("yyyy-LL-dd HH:mm")} ${tz || "UTC"})`

export type GhostReport = { lines: string[]; totalClusters: number; totalCandidates: number; totalExcessPlans: number; candidateIds: string[] }

export async function detectGhosts(orgFilter?: string): Promise<GhostReport> {
  const orgs = await systemDb.organization.findMany({
    where: orgFilter ? { id: orgFilter } : undefined,
    select: { id: true, name: true, slug: true, timezone: true },
  })
  let totalClusters = 0
  let totalCandidates = 0
  let totalExcessPlans = 0
  const out: string[] = []
  const candidateIds: string[] = []

  for (const org of orgs) {
    const plans = await systemDb.servicePlan.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, frequency: true, rrule: true, startTime: true, startDate: true, endDate: true, createdAt: true, serviceLocation: { select: { timezone: true } } },
    })
    const orgTz = org.timezone || "UTC"
    const orgLines: string[] = []

    for (const plan of plans) {
      const jobsRaw = await systemDb.job.findMany({
        where: { servicePlanId: plan.id, status: { not: "CANCELLED" } },
        select: {
          id: true, scheduledStart: true, plannedStart: true, status: true, createdAt: true, title: true,
          _count: { select: { assignments: true, timeEntries: true, photos: true } },
        },
        orderBy: { scheduledStart: "asc" },
      })
      if (jobsRaw.length === 0) continue
      const tz = plan.serviceLocation.timezone || orgTz
      const jobs: JobRow[] = jobsRaw.map((j) => ({
        id: j.id, scheduledStart: j.scheduledStart, plannedStart: j.plannedStart, status: j.status, createdAt: j.createdAt, title: j.title, tz,
        assignments: j._count.assignments, timeEntries: j._count.timeEntries, photos: j._count.photos,
      }))

      // ── SIGNAL 1: same plan + same site-local day ──
      const byDay = new Map<string, JobRow[]>()
      for (const j of jobs) {
        const day = localDay(j.scheduledStart, tz) ?? "unknown"
        ;(byDay.get(day) ?? byDay.set(day, []).get(day)!).push(j)
      }
      const clusters = [...byDay.entries()].filter(([, js]) => js.length > 1)

      // ── SIGNAL 2: excess vs expected occurrences ──
      const planned = jobs.map((j) => (j.plannedStart ?? j.scheduledStart).getTime())
      const spanMin = new Date(Math.min(...planned))
      const spanMax = new Date(Math.max(...planned) + 1000)
      const rec: PlanRecurrence = {
        frequency: plan.frequency as Frequency,
        startDate: plan.startDate ?? plan.createdAt,
        startTime: plan.startTime,
        rrule: plan.rrule,
        endDate: plan.endDate,
        timezone: tz,
      }
      let expected = 0
      try { expected = generateOccurrences(rec, spanMin, spanMax).length } catch { expected = jobs.length }
      const excess = jobs.length - expected

      if (clusters.length === 0 && excess <= 0) continue

      orgLines.push(`  • Plan "${plan.name}" (${plan.frequency}, tz ${tz}) — ${jobs.length} active jobs, ~${expected} expected occurrences, excess=${excess}`)
      for (const [day, js] of clusters) {
        totalClusters++
        orgLines.push(`      SAME-DAY cluster on ${day}: ${js.length} jobs`)
        // Keep the oldest job in the cluster; the newer untouched ones are the
        // regenerated ghosts. (A cluster where every job was worked flags none.)
        const oldest = [...js].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
        for (const j of js) {
          const isCand = untouched(j) && j.id !== oldest.id
          if (isCand) { totalCandidates++; candidateIds.push(j.id) }
          orgLines.push(`        ${isCand ? "GHOST?" : "KEEP  "} ${j.id}  start=${fmt(j.scheduledStart, tz)}  status=${j.status}  a/t/p=${j.assignments}/${j.timeEntries}/${j.photos}  created=${j.createdAt.toISOString()}`)
        }
      }
      if (excess > 0) totalExcessPlans++
    }

    if (orgLines.length) {
      out.push(`ORG ${org.name} (${org.slug}):`, ...orgLines, "")
    }
  }

  return { lines: out, totalClusters, totalCandidates, totalExcessPlans, candidateIds }
}

async function main() {
  const r = await detectGhosts()
  console.log("═══ GHOST-JOB DETECTION (READ-ONLY — nothing will be deleted) ═══\n")
  if (r.lines.length) console.log(r.lines.join("\n"))
  console.log("─── SUMMARY ───")
  console.log(`  Plans with excess jobs (Signal 2): ${r.totalExcessPlans}`)
  console.log(`  Same-day clusters (Signal 1):      ${r.totalClusters}`)
  console.log(`  Ghost CANDIDATES (untouched, newer-in-cluster): ${r.totalCandidates}`)
  console.log(`\n  Nothing was modified. Review candidates before any deletion.`)
  process.exit(0)
}

// Only auto-run when invoked directly (not when imported by the validator).
if (process.argv[1] && process.argv[1].endsWith("detect-ghost-jobs.ts")) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
