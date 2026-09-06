"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { apiSend } from "@/lib/client"
import { ISSUE_CATEGORIES } from "@/lib/zod-schemas"

type Item = {
  id: string
  label: string
  instructions: string | null
  isRequired: boolean
  requirePhoto: boolean
  isComplete: boolean
  note: string | null
  hasPhoto: boolean
}

type ClockLoc = { lat?: number; lng?: number; accuracyM?: number; source: string }

// Best-effort geolocation — clock actions proceed even if denied/unavailable.
function getLocation(): Promise<ClockLoc> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ source: "web" })
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy, source: "web" }),
      () => resolve({ source: "web" }),
      { timeout: 8000, maximumAge: 60000 },
    )
  })
}

export function FieldJobClient(props: {
  jobId: string
  status: string
  title: string
  customerName: string
  siteName: string
  address: string
  siteNotes: string | null
  scheduledLabel: string
  timezone: string
  isClockedIn: boolean
  jobNoteInitial: string
  openIssues: number
  checklist: Item[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unmet, setUnmet] = useState<string[] | null>(null)
  const done = props.checklist.filter((i) => i.isComplete).length

  async function clock(kind: "in" | "out") {
    setBusy(true)
    setError(null)
    setUnmet(null)
    const loc = await getLocation()
    const res = await apiSend<{ unmet?: string[] }>(`/api/jobs/${props.jobId}/clock-${kind}`, "POST", loc)
    setBusy(false)
    if (!res.ok) {
      // 422 requirements block on clock-out carries `unmet`.
      if (res.unmet?.length) setUnmet(res.unmet)
      else setError(res.error)
      return
    }
    router.refresh()
  }

  const completed = props.status === "COMPLETED"
  const cancelled = props.status === "CANCELLED"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-lg font-semibold text-slate-900">{props.customerName}</div>
        <div className="text-sm text-slate-600">{props.siteName}</div>
        {props.address ? <div className="mt-1 text-sm text-slate-400">{props.address}</div> : null}
        <div className="mt-2 text-sm text-slate-500">{props.scheduledLabel}</div>
        {props.siteNotes ? (
          <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-800">
            <span className="font-semibold">Access notes: </span>
            {props.siteNotes}
          </div>
        ) : null}
      </div>

      {/* Checklist */}
      {props.checklist.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Scope of work</h2>
            <span className="text-xs text-slate-400">
              {done}/{props.checklist.length} done
            </span>
          </div>
          <ul className="space-y-2">
            {props.checklist.map((it) => (
              <ChecklistRow key={it.id} jobId={props.jobId} item={it} disabled={completed || cancelled || !props.isClockedIn} />
            ))}
          </ul>
          {!props.isClockedIn && !completed ? (
            <p className="mt-3 text-xs text-slate-400">Clock in to start checking off work.</p>
          ) : null}
        </div>
      ) : null}

      {/* Notes + Report */}
      {props.isClockedIn && !completed ? (
        <>
          <JobNote jobId={props.jobId} initial={props.jobNoteInitial} />
          <ReportProblem jobId={props.jobId} />
        </>
      ) : null}

      {/* Errors */}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {unmet ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Finish required work before clocking out:</p>
          <ul className="mt-1 list-disc pl-5">
            {unmet.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Primary clock control (sticky-ish bottom) */}
      <div className="pb-safe sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50 px-4 py-3">
        {completed ? (
          <div className="rounded-2xl bg-emerald-600 py-4 text-center text-base font-semibold text-white">Job completed ✓</div>
        ) : cancelled ? (
          <div className="rounded-2xl bg-slate-400 py-4 text-center text-base font-semibold text-white">Job cancelled</div>
        ) : props.isClockedIn ? (
          <button
            disabled={busy}
            onClick={() => clock("out")}
            className="w-full rounded-2xl bg-brand py-4 text-center text-base font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Clocking out…" : "Clock out & finish"}
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => clock("in")}
            className="w-full rounded-2xl bg-brand py-4 text-center text-base font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Clocking in…" : "Clock in"}
          </button>
        )}
      </div>
    </div>
  )
}

function ChecklistRow({ jobId, item, disabled }: { jobId: string; item: Item; disabled: boolean }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (disabled) return
    setBusy(true)
    await apiSend(`/api/jobs/${jobId}/checklist/${item.id}`, "PATCH", { isComplete: !item.isComplete })
    setBusy(false)
    router.refresh()
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const form = new FormData()
    form.append("file", file)
    form.append("jobChecklistItemId", item.id)
    await fetch(`/api/jobs/${jobId}/photos`, { method: "POST", body: form })
    setBusy(false)
    router.refresh()
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={disabled || busy}
          aria-label={item.isComplete ? "Mark incomplete" : "Mark complete"}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
            item.isComplete ? "border-brand bg-brand text-white" : "border-slate-300 text-transparent"
          } disabled:opacity-50`}
        >
          ✓
        </button>
        <div className="flex-1">
          <div className={`text-sm font-medium ${item.isComplete ? "text-slate-400 line-through" : "text-slate-800"}`}>
            {item.label}
            {item.isRequired ? <span className="ml-1 text-red-500">*</span> : null}
          </div>
          {item.instructions ? <div className="text-xs text-slate-500">{item.instructions}</div> : null}
          {item.requirePhoto ? (
            <div className="mt-2">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={upload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={disabled || busy}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  item.hasPhoto ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                } disabled:opacity-50`}
              >
                {item.hasPhoto ? "Photo added ✓ — retake" : "Add required photo"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function JobNote({ jobId, initial }: { jobId: string; initial: string }) {
  const [note, setNote] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    setSaved(false)
    const res = await apiSend(`/api/jobs/${jobId}/note`, "PATCH", { note })
    setBusy(false)
    if (res.ok) setSaved(true)
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Job note</h2>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setSaved(false)
        }}
        placeholder="Anything the office should know?"
        className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50">
          {busy ? "Saving…" : "Save note"}
        </button>
        {saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
      </div>
    </div>
  )
}

function ReportProblem({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState("OTHER")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await apiSend<{ id: string }>(`/api/jobs/${jobId}/issues`, "POST", { category, description })
    if (!res.ok) {
      setBusy(false)
      return setError(res.error)
    }
    if (file) {
      const form = new FormData()
      form.append("file", file)
      form.append("issueId", res.data.id)
      await fetch(`/api/jobs/${jobId}/photos`, { method: "POST", body: form })
    }
    setBusy(false)
    setOpen(false)
    setDescription("")
    setFile(null)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-red-200 bg-white py-3 text-center text-sm font-semibold text-red-700 active:bg-red-50"
      >
        Report a problem
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report a problem">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">What happened?</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Photo (optional)</label>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
