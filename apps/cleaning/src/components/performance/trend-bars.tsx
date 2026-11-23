import type { TrendPoint } from "@/lib/performance/metrics"

// Simple, dependency-free monthly trend. Server-rendered; no client JS. Shows
// completed (brand), verified (emerald), and rejected/rework (amber) per month.
export function TrendBars({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.completed))
  const anyData = points.some((p) => p.completed || p.verified || p.rejected)
  if (!anyData) return <p className="text-sm text-slate-400">No activity in this period yet.</p>
  return (
    <div>
      <div className="flex items-end gap-3">
        {points.map((p) => (
          <div key={p.period} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-28 w-full items-end justify-center gap-0.5">
              <Bar value={p.completed} max={max} cls="bg-brand" title={`${p.completed} completed`} />
              <Bar value={p.verified} max={max} cls="bg-emerald-500" title={`${p.verified} verified`} />
              <Bar value={p.rejected} max={max} cls="bg-amber-500" title={`${p.rejected} rework`} />
            </div>
            <div className="text-[11px] text-slate-400">{p.period.slice(5)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <Legend cls="bg-brand" label="Completed" />
        <Legend cls="bg-emerald-500" label="Verified" />
        <Legend cls="bg-amber-500" label="Rework" />
      </div>
    </div>
  )
}

function Bar({ value, max, cls, title }: { value: number; max: number; cls: string; title: string }) {
  const h = value === 0 ? 2 : Math.max(4, Math.round((value / max) * 112))
  return <div className={`w-2.5 rounded-t ${value === 0 ? "bg-slate-100" : cls}`} style={{ height: `${h}px` }} title={title} />
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${cls}`} /> {label}
    </span>
  )
}
