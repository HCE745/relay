"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

export type TaskItem = {
  id: string
  label: string
  isRequired: boolean
  requirePhoto: boolean
  photoCount: number
  verificationStatus: string
  assignedToId: string | null
  assignedToName: string | null
  assigneeIds: string[]
  assigneeNames: string[]
  verifierName: string | null
  rejectionReason: string | null
  note: string | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ASSIGNED: { label: "Assigned", cls: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "In progress", cls: "bg-sky-100 text-sky-700" },
  COMPLETED: { label: "Done", cls: "bg-emerald-50 text-emerald-700" },
  COMPLETED_AWAITING_VERIFICATION: { label: "Awaiting verification", cls: "bg-amber-100 text-amber-800" },
  VERIFIED: { label: "Verified", cls: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Correction required", cls: "bg-red-100 text-red-700" },
  CORRECTED_AWAITING_REINSPECTION: { label: "Corrected — re-check", cls: "bg-amber-100 text-amber-800" },
}

// Once work is reported done, a supervisor/inspector can verify it: the awaiting
// states, plus COMPLETED (an optional verification when it was not required).
const VERIFIABLE = new Set(["COMPLETED", "COMPLETED_AWAITING_VERIFICATION", "CORRECTED_AWAITING_REINSPECTION"])

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

export function TaskVerificationPanel(props: {
  jobId: string
  items: TaskItem[]
  cleaners: { id: string; name: string }[]
  canManage: boolean
  canVerify: boolean
}) {
  const done = props.items.filter((i) => i.verificationStatus === "VERIFIED").length
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Tasks &amp; verification</h2>
        <span className="text-xs text-slate-400">{done}/{props.items.length} verified</span>
      </div>
      {props.items.length === 0 ? (
        <p className="text-sm text-slate-500">No checklist.</p>
      ) : (
        <ul className="space-y-2.5">
          {props.items.map((it) => (
            <li key={it.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{it.label}</span>
                {it.isRequired ? <span className="text-red-500">*</span> : null}
                <StatusBadge status={it.verificationStatus} />
                {it.requirePhoto ? (
                  <span className={`text-xs ${it.photoCount ? "text-emerald-600" : "text-orange-500"}`}>
                    {it.photoCount ? "photo ✓" : "photo pending"}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {it.assigneeNames.length > 0 ? (
                  <>Owner{it.assigneeNames.length > 1 ? "s" : ""}: {it.assigneeNames.join(", ")}</>
                ) : (
                  <>Owner: <span className="text-slate-400">unassigned</span></>
                )}
                {it.verifierName ? <> · Verified by {it.verifierName}</> : null}
              </div>
              {it.verificationStatus === "REJECTED" && it.rejectionReason ? (
                <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Reason: {it.rejectionReason}</div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {props.canManage ? <AssignControl jobId={props.jobId} item={it} cleaners={props.cleaners} /> : null}
                {props.canVerify && VERIFIABLE.has(it.verificationStatus) ? (
                  <VerifyControls jobId={props.jobId} itemId={it.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

// Assign a task to one OR MORE employees (shared ownership). The first selected
// cleaner is the primary owner; the rest are shared owners. No API needed —
// managers pick the crew right here.
function AssignControl({ jobId, item, cleaners }: { jobId: string; item: TaskItem; cleaners: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<string[]>(item.assigneeIds)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toggle(id: string) {
    setErr(null)
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function save() {
    setBusy(true)
    setErr(null)
    // Preserve cleaner list order so the "primary" owner is stable/predictable.
    const assigneeIds = cleaners.filter((c) => sel.includes(c.id)).map((c) => c.id)
    const res = await apiSend(`/api/jobs/${jobId}/checklist/${item.id}/assign`, "POST", { assigneeIds })
    setBusy(false)
    if (!res.ok) return setErr(res.error)
    setOpen(false)
    router.refresh()
  }

  const unchanged = sameSet(sel, item.assigneeIds)

  if (!open) {
    return (
      <button
        onClick={() => { setSel(item.assigneeIds); setOpen(true) }}
        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
      >
        {item.assigneeIds.length ? "Edit owners" : "Assign"}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      {cleaners.length === 0 ? (
        <p className="text-xs text-slate-500">No assignable employees.</p>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {cleaners.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`Assign ${c.name}`} />
              {c.name}
            </label>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={save}
          disabled={busy || unchanged}
          className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : sel.length > 1 ? `Assign ${sel.length}` : sel.length === 1 ? "Assign" : "Unassign"}
        </button>
        <button onClick={() => { setOpen(false); setErr(null) }} disabled={busy} className="rounded-lg px-2 py-1 text-xs text-slate-500">
          Cancel
        </button>
        {err ? <span className="text-xs text-red-600">{err}</span> : null}
      </div>
    </div>
  )
}

function VerifyControls({ jobId, itemId }: { jobId: string; itemId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function act(approve: boolean) {
    let note: string | undefined
    if (!approve) {
      const reason = window.prompt("Reason for rejection (what needs correcting)?")
      if (reason === null) return
      note = reason
    }
    setBusy(true)
    setErr(null)
    const res = await apiSend(`/api/jobs/${jobId}/checklist/${itemId}/verify`, "POST", { approve, note })
    setBusy(false)
    if (!res.ok) return setErr(res.error)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => act(true)} disabled={busy} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
        Verify
      </button>
      <button onClick={() => act(false)} disabled={busy} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
        Reject
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </div>
  )
}
