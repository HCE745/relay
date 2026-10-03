"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button, Card, Field, Input, Select, StatusBadge } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Shift = { jobId: string; title: string; scheduledStart: string; siteName: string; customerName: string; unavailable: { userId: string; name: string }[] }
type Pending = { id: string; userName: string; startDate: string; endDate: string; reason: string | null }
type Block = { id: string; userName: string; startDate: string; endDate: string; reason: string | null; source: string }
type Member = { id: string; name: string }
type Candidate = { userId: string; name: string; priorJobsAtSite: number }

const fmtDT = (s: string) => new Date(s).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const fmtD = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

function CoverageRow({ shift }: { shift: Shift }) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fromUser = shift.unavailable[0]

  async function findCoverage() {
    setLoading(true); setError(null)
    const r = await fetch(`/api/coverage/${shift.jobId}/candidates`).then((x) => x.json()).catch(() => null)
    setLoading(false)
    if (!r || r.error) return setError(r?.error ?? "Could not load candidates")
    setCandidates(r as Candidate[])
  }

  async function reassign(toUserId: string) {
    setBusyId(toUserId); setError(null)
    const res = await apiSend(`/api/coverage/${shift.jobId}/reassign`, "POST", { fromUserId: fromUser?.userId, toUserId })
    setBusyId(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/jobs/${shift.jobId}`} className="font-semibold text-slate-900 hover:text-brand">{shift.title}</Link>
          <div className="text-sm text-slate-500">{shift.customerName} · {shift.siteName}</div>
          <div className="mt-1 text-sm text-slate-600">{fmtDT(shift.scheduledStart)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {shift.unavailable.map((u) => (
              <StatusBadge key={u.userId} tone="danger">{u.name} unavailable</StatusBadge>
            ))}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={findCoverage} disabled={loading}>{loading ? "Finding…" : "Find coverage"}</Button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {candidates ? (
        candidates.length === 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No available cleaners for this time.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {candidates.map((c) => (
              <li key={c.userId} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{c.priorJobsAtSite} prior job{c.priorJobsAtSite === 1 ? "" : "s"} at this site</span>
                </span>
                <Button size="sm" onClick={() => reassign(c.userId)} disabled={busyId === c.userId}>{busyId === c.userId ? "Assigning…" : "Reassign"}</Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  )
}

function TimeOffReview({ pending }: { pending: Pending[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function review(id: string, action: "approve" | "deny") {
    setBusy(id)
    await apiSend(`/api/time-off/${id}`, "PATCH", { action })
    setBusy(null)
    router.refresh()
  }
  if (pending.length === 0) return <p className="text-sm text-slate-500">No pending time-off requests.</p>
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {pending.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="text-sm">
            <span className="font-medium text-slate-800">{p.userName}</span>
            <span className="ml-2 text-slate-600">{fmtD(p.startDate)} – {fmtD(p.endDate)}</span>
            {p.reason ? <div className="text-xs text-slate-500">{p.reason}</div> : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => review(p.id, "approve")} disabled={busy === p.id}>Approve</Button>
            <Button size="sm" variant="secondary" onClick={() => review(p.id, "deny")} disabled={busy === p.id}>Deny</Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AvailabilityManager({ members, blocks }: { members: Member[]; blocks: Block[] }) {
  const router = useRouter()
  const [userId, setUserId] = useState(members[0]?.id ?? "")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setBusy(true); setError(null)
    const res = await apiSend("/api/availability", "POST", { userId, startDate, endDate, reason: reason || undefined })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setStartDate(""); setEndDate(""); setReason("")
    router.refresh()
  }
  async function remove(id: string) {
    await apiSend(`/api/availability/${id}`, "DELETE")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Field label="Cleaner" htmlFor="a-user"><Select id="a-user" value={userId} onChange={(e) => setUserId(e.target.value)}>{members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}</Select></Field>
        <Field label="From" htmlFor="a-start"><Input id="a-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="To" htmlFor="a-end"><Input id="a-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
        <Field label="Reason" htmlFor="a-reason"><Input id="a-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" /></Field>
        <div className="flex items-end"><Button onClick={add} disabled={busy || !userId || !startDate || !endDate}>{busy ? "Saving…" : "Mark unavailable"}</Button></div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {blocks.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span><span className="font-medium text-slate-800">{b.userName}</span> <span className="text-slate-600">{fmtD(b.startDate)} – {fmtD(b.endDate)}</span>{b.reason ? <span className="text-slate-400"> · {b.reason}</span> : null}{b.source === "TIME_OFF" ? <StatusBadge tone="info" className="ml-2">time off</StatusBadge> : null}</span>
              <button onClick={() => remove(b.id)} className="text-slate-400 hover:text-red-600" aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-400">No upcoming unavailability.</p>}
    </div>
  )
}

export function CoverageClient({ shifts, pending, members, blocks }: { shifts: Shift[]; pending: Pending[]; members: Member[]; blocks: Block[] }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Uncovered shifts — next 48 hours</h2>
        {shifts.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">All upcoming shifts are covered.</Card>
        ) : (
          <div className="space-y-3">{shifts.map((s) => <CoverageRow key={s.jobId} shift={s} />)}</div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Pending time-off requests</h2>
        <TimeOffReview pending={pending} />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Mark a cleaner unavailable</h2>
        <Card className="p-5"><AvailabilityManager members={members} blocks={blocks} /></Card>
      </section>
    </div>
  )
}
