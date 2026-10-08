"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, Select, Textarea, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { APPLICANT_STATUSES, JOB_POSTING_STATUSES, EMPLOYMENT_TYPES } from "@/lib/zod-schemas"

type Posting = { id: string; title: string; status: string; employmentType: string | null; payRange: string | null; locations: string | null; applicantCount: number }
type Interview = { id: string; date: string; outcomeNotes: string | null }
type Applicant = { id: string; name: string; email: string | null; phone: string | null; status: string; appliedFor: string | null; convertedUserId: string | null; interviews: Interview[] }
type Member = { id: string; name: string }

const A_TONE: Record<string, BadgeTone> = { NEW: "info", SCREENING: "purple", INTERVIEW: "warning", OFFER: "brand", HIRED: "success", REJECTED: "neutral" }
const P_TONE: Record<string, BadgeTone> = { DRAFT: "neutral", OPEN: "success", CLOSED: "neutral" }

export function NewPostingButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({ title: "", employmentType: "Full-time", payRange: "", locations: "", description: "", status: "OPEN" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  async function save() {
    setBusy(true); setError(null)
    const res = await apiSend("/api/job-postings", "POST", { title: v.title, employmentType: v.employmentType, payRange: v.payRange || undefined, locations: v.locations || undefined, description: v.description || undefined, status: v.status })
    setBusy(false); if (!res.ok) return setError(res.error)
    setOpen(false); setV({ ...v, title: "", payRange: "", locations: "", description: "" }); router.refresh()
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>New posting</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New job posting">
        <div className="space-y-3">
          <Field label="Title" htmlFor="p-title"><Input id="p-title" value={v.title} onChange={set("title")} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employment type" htmlFor="p-type"><Select id="p-type" value={v.employmentType} onChange={set("employmentType")}>{EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
            <Field label="Status" htmlFor="p-status"><Select id="p-status" value={v.status} onChange={set("status")}>{JOB_POSTING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pay range" htmlFor="p-pay"><Input id="p-pay" value={v.payRange} onChange={set("payRange")} placeholder="$18–$24/hr" /></Field>
            <Field label="Locations" htmlFor="p-loc"><Input id="p-loc" value={v.locations} onChange={set("locations")} placeholder="Austin, TX" /></Field>
          </div>
          <Field label="Description" htmlFor="p-desc"><Textarea id="p-desc" value={v.description} onChange={set("description")} /></Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={busy || !v.title}>Create</Button></div>
        </div>
      </Modal>
    </>
  )
}

function ApplicantCard({ a, members }: { a: Applicant; members: Member[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"none" | "interview" | "convert">("none")
  const [iv, setIv] = useState({ date: new Date().toISOString().slice(0, 10), interviewerId: members[0]?.id ?? "", outcomeNotes: "" })
  const [cv, setCv] = useState({ role: "CLEANER", payType: "HOURLY", payRate: "20" })
  const hired = !!a.convertedUserId

  async function setStatus(status: string) { setBusy(true); await apiSend(`/api/applicants/${a.id}`, "PATCH", { status }); setBusy(false); router.refresh() }
  async function addInterview() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/applicants/${a.id}/interviews`, "POST", { date: iv.date, interviewerId: iv.interviewerId || undefined, outcomeNotes: iv.outcomeNotes || undefined })
    setBusy(false); if (!res.ok) return setError(res.error)
    setMode("none"); router.refresh()
  }
  async function convert() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/applicants/${a.id}/convert`, "POST", { role: cv.role, payType: cv.payType, payRate: cv.payRate || undefined })
    setBusy(false); if (!res.ok) return setError(res.error)
    setMode("none"); router.refresh()
  }

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{a.name}</div>
          <div className="truncate text-xs text-slate-500">{a.appliedFor ?? "—"}{a.email ? ` · ${a.email}` : ""}</div>
          {a.interviews.length > 0 ? <div className="mt-0.5 text-xs text-slate-400">{a.interviews.length} interview{a.interviews.length === 1 ? "" : "s"}</div> : null}
        </div>
        {hired ? <StatusBadge tone="success">Hired ✓</StatusBadge> : null}
      </div>
      {!hired ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Select value={a.status} onChange={(e) => setStatus(e.target.value)} className="w-32 py-1 text-xs" disabled={busy}>{APPLICANT_STATUSES.filter((s) => s !== "HIRED").map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          <Button size="sm" variant="ghost" onClick={() => setMode(mode === "interview" ? "none" : "interview")}>+ Interview</Button>
          {a.status === "HIRED" || a.status === "OFFER" ? <Button size="sm" onClick={() => setMode(mode === "convert" ? "none" : "convert")}>Hire → Employee</Button> : null}
        </div>
      ) : null}
      {mode === "interview" ? (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={iv.date} onChange={(e) => setIv({ ...iv, date: e.target.value })} />
            <Select value={iv.interviewerId} onChange={(e) => setIv({ ...iv, interviewerId: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
          </div>
          <Input placeholder="Outcome notes" value={iv.outcomeNotes} onChange={(e) => setIv({ ...iv, outcomeNotes: e.target.value })} />
          <Button size="sm" onClick={addInterview} disabled={busy}>Save interview</Button>
        </div>
      ) : null}
      {mode === "convert" ? (
        <div className="mt-2 space-y-2 rounded-lg bg-emerald-50 p-2">
          <p className="text-xs text-emerald-800">Set status to HIRED first, then create the employee account. Carries name, contact and availability.</p>
          <div className="grid grid-cols-3 gap-2">
            <Select value={cv.role} onChange={(e) => setCv({ ...cv, role: e.target.value })}><option>CLEANER</option><option>SUPERVISOR</option><option>MANAGER</option></Select>
            <Select value={cv.payType} onChange={(e) => setCv({ ...cv, payType: e.target.value })}><option>HOURLY</option><option>SALARY</option></Select>
            <Input placeholder="Rate" value={cv.payRate} onChange={(e) => setCv({ ...cv, payRate: e.target.value })} inputMode="decimal" />
          </div>
          <Button size="sm" onClick={convert} disabled={busy}>Create employee</Button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </Card>
  )
}

export function HiringClient({ postings, applicants, members }: { postings: Posting[]; applicants: Applicant[]; members: Member[] }) {
  const cols = APPLICANT_STATUSES
  const byStatus = (s: string) => applicants.filter((a) => a.status === s && !(a.convertedUserId && s !== "HIRED"))
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Job postings</h2>
        {postings.length === 0 ? <Card className="p-5 text-center text-sm text-slate-500">No postings yet.</Card> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {postings.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900">{p.title}</div>
                  <StatusBadge tone={P_TONE[p.status] ?? "neutral"}>{p.status}</StatusBadge>
                </div>
                <div className="mt-1 text-xs text-slate-500">{[p.employmentType, p.payRange, p.locations].filter(Boolean).join(" · ") || "—"}</div>
                <div className="mt-2 text-xs text-slate-400">{p.applicantCount} applicant{p.applicantCount === 1 ? "" : "s"}</div>
              </Card>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Applicant pipeline</h2>
        <div className="grid gap-3 lg:grid-cols-6">
          {cols.map((s) => (
            <div key={s}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><StatusBadge tone={A_TONE[s]}>{s}</StatusBadge><span className="text-slate-400">{byStatus(s).length}</span></div>
              <div className="space-y-2">
                {byStatus(s).map((a) => <ApplicantCard key={a.id} a={a} members={members} />)}
                {byStatus(s).length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-300">—</div> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
