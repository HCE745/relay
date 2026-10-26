"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { Card } from "@/components/ui/controls"
import { PeekLink } from "@/components/peek/peek"

type Job = { id: string; title: string; status: string; startIso: string; endIso: string | null; siteName: string | null; customerName: string | null; crew: string[] }
type Ops = {
  nowIso: string
  today: Job[]
  week: { dateIso: string; label: string; dayNum: string; count: number; completed: number; isToday: boolean }[]
  exceptions: {
    unassigned: { id: string; title: string }[]
    understaffed: { id: string; title: string; have: number; need: number }[]
    overdueIssues: { id: string; title: string }[]
    missedClockIns: { id: string; title: string }[]
    pendingApproval: number
  }
}

const STATUS_DOT: Record<string, string> = { SCHEDULED: "bg-slate-300", ASSIGNED: "bg-sky-400", IN_PROGRESS: "bg-amber-400", COMPLETED: "bg-emerald-500", MISSED: "bg-red-400" }
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")

// Re-fetch the server component on an interval. router.refresh() updates data in
// place (no full reload, no scroll/layout jump).
function AutoRefresh({ ms }: { ms: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), ms)
    return () => clearInterval(id)
  }, [router, ms])
  return null
}

export function OperationsView({ ops, tz }: { ops: Ops; tz: string }) {
  const now = DateTime.fromISO(ops.nowIso).setZone(tz)
  const fmt = (iso: string) => DateTime.fromISO(iso).setZone(tz).toFormat("h:mm a")
  const nowMs = now.toMillis()
  const nowIdx = ops.today.findIndex((j) => DateTime.fromISO(j.startIso).toMillis() >= nowMs)
  const ex = ops.exceptions
  const totalExceptions = ex.unassigned.length + ex.understaffed.length + ex.overdueIssues.length + ex.missedClockIns.length + (ex.pendingApproval > 0 ? 1 : 0)

  return (
    <div className="space-y-5">
      <AutoRefresh ms={30_000} />

      {/* Week at a glance */}
      <div className="grid grid-cols-7 gap-1.5">
        {ops.week.map((d) => (
          <Link key={d.dateIso} href="/schedule" className={`rounded-xl border px-2 py-2 text-center transition hover:border-brand ${d.isToday ? "border-brand bg-brand-50" : "border-slate-200 bg-white"}`}>
            <div className={`text-[11px] font-semibold uppercase ${d.isToday ? "text-brand-700" : "text-slate-400"}`}>{d.label}</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{d.dayNum}</div>
            <div className="text-[11px] text-slate-500">{d.count === 0 ? "—" : `${d.completed}/${d.count}`}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Center: today's running timeline */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Today</h2>
            <span className="text-xs text-slate-400">{now.toFormat("ccc MMM d · h:mm a")}</span>
          </div>
          {ops.today.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nothing scheduled today.</p>
          ) : (
            <ol className="relative space-y-1">
              {ops.today.map((j, i) => (
                <li key={j.id}>
                  {i === nowIdx ? <NowMarker label={now.toFormat("h:mm a")} /> : null}
                  <PeekLink type="job" id={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50">
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">{fmt(j.startIso)}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[j.status] ?? "bg-slate-300"}`} title={titleize(j.status)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{j.title}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {j.customerName ? `${j.customerName} · ${j.siteName}` : j.siteName}
                        {j.crew.length ? ` · ${j.crew.join(", ")}` : <span className="text-red-500"> · unassigned</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">{titleize(j.status)}</span>
                  </PeekLink>
                </li>
              ))}
              {nowIdx === -1 ? <NowMarker label={`${now.toFormat("h:mm a")} · rest of day clear`} /> : null}
            </ol>
          )}
        </Card>

        {/* Right: exceptions needing action */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Needs action</h2>
            {totalExceptions > 0
              ? <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{totalExceptions}</span>
              : <span className="text-xs text-emerald-600">All clear</span>}
          </div>
          <div className="space-y-4">
            <ExceptionGroup title="Unassigned" items={ex.unassigned.map((j) => ({ id: j.id, label: j.title, type: "job", href: `/jobs/${j.id}` }))} />
            <ExceptionGroup title="Understaffed" items={ex.understaffed.map((j) => ({ id: j.id, label: `${j.title} (${j.have}/${j.need})`, type: "job", href: `/jobs/${j.id}` }))} />
            <ExceptionGroup title="Missed clock-in" items={ex.missedClockIns.map((j) => ({ id: j.id, label: j.title, type: "job", href: `/jobs/${j.id}` }))} />
            <ExceptionGroup title="Overdue issues" items={ex.overdueIssues.map((i) => ({ id: i.id, label: i.title, type: "issue", href: `/issues/${i.id}` }))} />
            {ex.pendingApproval > 0 ? (
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Time to approve</div>
                <Link href="/time?status=pending" className="block truncate rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">{ex.pendingApproval} entr{ex.pendingApproval === 1 ? "y" : "ies"} awaiting approval →</Link>
              </div>
            ) : null}
            {totalExceptions === 0 ? <p className="text-sm text-slate-400">No exceptions right now.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  )
}

function NowMarker({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-2" aria-hidden>
      <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums text-brand-700">now</span>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      <span className="h-px flex-1 bg-brand/40" />
      <span className="text-[11px] text-brand-700">{label}</span>
    </div>
  )
}

function ExceptionGroup({ title, items }: { title: string; items: { id: string; label: string; type: string; href: string }[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <PeekLink type={it.type} id={it.id} href={it.href} className="block truncate rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">{it.label}</PeekLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
