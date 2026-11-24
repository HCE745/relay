import Link from "next/link"
import { Card, StatusBadge } from "@/components/ui/controls"
import type { SiteActivity } from "@/lib/data/site-activity"

const titleize = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  COMPLETED: "success", RESOLVED: "success", VERIFIED: "success", CLOSED: "neutral",
  SCHEDULED: "info", ASSIGNED: "info", IN_PROGRESS: "info", REQUESTED: "warning",
  OPEN: "warning", ACKNOWLEDGED: "warning", CANCELLED: "neutral",
}
const tone = (s?: string | null) => (s ? STATUS_TONE[s] ?? "neutral" : "neutral")

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title} <span className="text-slate-400">({count})</span></h3>
      {children}
    </Card>
  )
}

export function SiteActivitySection({ activity, caps }: { activity: SiteActivity; caps: { jobs: boolean; issues: boolean; workOrders: boolean } }) {
  const a = activity
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">Site activity</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        {caps.jobs ? (
          <Section title="Jobs" count={a.jobs.count}>
            {a.jobs.items.length === 0 ? <p className="text-sm text-slate-400">No jobs.</p> : (
              <ul className="divide-y divide-slate-100">{a.jobs.items.map((j) => (
                <li key={j.id} className="py-1.5"><Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand"><span className="min-w-0 truncate text-slate-800">{j.title}</span><span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">{fmtDate(j.scheduledStart)}<StatusBadge tone={tone(j.status)}>{titleize(j.status)}</StatusBadge></span></Link></li>
              ))}</ul>
            )}
          </Section>
        ) : null}
        {caps.issues ? (
          <Section title="Issues & complaints" count={a.issues.count}>
            {a.issues.items.length === 0 ? <p className="text-sm text-slate-400">No issues.</p> : (
              <ul className="divide-y divide-slate-100">{a.issues.items.map((i) => (
                <li key={i.id} className="py-1.5"><Link href={`/issues/${i.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand"><span className="min-w-0 truncate text-slate-800">{(i.title ?? i.description).slice(0, 40)}</span><StatusBadge tone={tone(i.status)}>{titleize(i.status)}</StatusBadge></Link></li>
              ))}</ul>
            )}
          </Section>
        ) : null}
        {caps.workOrders ? (
          <Section title="Work orders" count={a.workOrders.count}>
            {a.workOrders.items.length === 0 ? <p className="text-sm text-slate-400">No work orders.</p> : (
              <ul className="divide-y divide-slate-100">{a.workOrders.items.map((w) => (
                <li key={w.id} className="py-1.5"><Link href={`/work-orders/${w.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand"><span className="min-w-0 truncate text-slate-800">{w.description.slice(0, 40)}</span><StatusBadge tone={tone(w.status)}>{titleize(w.status)}</StatusBadge></Link></li>
              ))}</ul>
            )}
          </Section>
        ) : null}
      </div>
    </section>
  )
}
