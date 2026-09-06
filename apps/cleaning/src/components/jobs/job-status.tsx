// Server-safe Job status badge with a distinct color per lifecycle state.

const STYLES: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Scheduled", cls: "bg-slate-100 text-slate-600" },
  ASSIGNED: { label: "Assigned", cls: "bg-indigo-50 text-indigo-700" },
  IN_PROGRESS: { label: "In progress", cls: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-50 text-emerald-700" },
  MISSED: { label: "Missed", cls: "bg-red-50 text-red-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-400 line-through" },
}

export function JobStatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

export function UnassignedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
      Unassigned
    </span>
  )
}
