// Single source of truth for job-status presentation. The badge, the schedule
// calendar blocks, and the calendar legend all read from JOB_STATUS so a given
// status looks identical everywhere in the app.
import { StatusBadge, type BadgeTone } from "@/components/ui/controls"

export type JobStatusStyle = {
  label: string
  tone: BadgeTone
  className?: string
  /** Calendar block surface (bg + border + text) — full literal classes so Tailwind scans them. */
  block: string
  /** Legend/indicator dot. */
  dot: string
}

// Ordered so the legend reads in lifecycle order.
export const JOB_STATUS: Record<string, JobStatusStyle> = {
  SCHEDULED: { label: "Scheduled", tone: "neutral", block: "bg-slate-100 border-slate-300 text-slate-700", dot: "bg-slate-400" },
  ASSIGNED: { label: "Assigned", tone: "purple", block: "bg-indigo-50 border-indigo-300 text-indigo-900", dot: "bg-indigo-500" },
  IN_PROGRESS: { label: "In progress", tone: "warning", block: "bg-amber-50 border-amber-300 text-amber-900", dot: "bg-amber-500" },
  COMPLETED: { label: "Completed", tone: "success", block: "bg-emerald-50 border-emerald-300 text-emerald-900", dot: "bg-emerald-500" },
  MISSED: { label: "Missed", tone: "danger", block: "bg-red-50 border-red-300 text-red-900", dot: "bg-red-500" },
  CANCELLED: { label: "Cancelled", tone: "neutral", className: "line-through text-slate-400", block: "bg-slate-50 border-slate-200 text-slate-400", dot: "bg-slate-300" },
}

export const JOB_STATUS_ORDER = ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"] as const

export function jobStatusStyle(status: string): JobStatusStyle {
  return JOB_STATUS[status] ?? { label: status, tone: "neutral", block: "bg-slate-100 border-slate-300 text-slate-700", dot: "bg-slate-400" }
}

export function JobStatusBadge({ status }: { status: string }) {
  const s = jobStatusStyle(status)
  return (
    <StatusBadge tone={s.tone} className={s.className}>
      {s.label}
    </StatusBadge>
  )
}

export function UnassignedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
      Unassigned
    </span>
  )
}
