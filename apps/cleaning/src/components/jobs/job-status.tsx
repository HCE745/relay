// Server-safe Job status badge — built on the shared StatusBadge so a status
// looks identical here, on the schedule, and on job detail.
import { StatusBadge, type BadgeTone } from "@/components/ui/controls"

const STYLES: Record<string, { label: string; tone: BadgeTone; className?: string }> = {
  SCHEDULED: { label: "Scheduled", tone: "neutral" },
  ASSIGNED: { label: "Assigned", tone: "purple" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  MISSED: { label: "Missed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral", className: "line-through text-slate-400" },
}

export function JobStatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, tone: "neutral" as BadgeTone }
  return (
    <StatusBadge tone={s.tone} className={s.className}>
      {s.label}
    </StatusBadge>
  )
}

export function UnassignedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
      Unassigned
    </span>
  )
}
