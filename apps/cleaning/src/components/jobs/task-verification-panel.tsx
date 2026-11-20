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
  verifierName: string | null
  rejectionReason: string | null
  note: string | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ASSIGNED: { label: "Assigned", cls: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "In progress", cls: "bg-sky-100 text-sky-700" },
  COMPLETED_AWAITING_VERIFICATION: { label: "Awaiting verification", cls: "bg-amber-100 text-amber-800" },
  VERIFIED: { label: "Verified", cls: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Correction required", cls: "bg-red-100 text-red-700" },
  CORRECTED_AWAITING_REINSPECTION: { label: "Corrected — re-check", cls: "bg-amber-100 text-amber-800" },
}

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
  const awaiting = (s: string) => s === "COMPLETED_AWAITING_VERIFICATION" || s === "CORRECTED_AWAITING_REINSPECTION"
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
                Owner: {it.assignedToName ?? <span className="text-slate-400">unassigned</span>}
                {it.verifierName ? <> · Verified by {it.verifierName}</> : null}
              </div>
              {it.verificationStatus === "REJECTED" && it.rejectionReason ? (
                <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Reason: {it.rejectionReason}</div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {props.canManage ? <AssignControl jobId={props.jobId} item={it} cleaners={props.cleaners} /> : null}
                {props.canVerify && awaiting(it.verificationStatus) ? (
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

function AssignControl({ jobId, item, cleaners }: { jobId: string; item: TaskItem; cleaners: { id: string; name: string }[] }) {
  const router = useRouter()
  const [sel, setSel] = useState(item.assignedToId ?? "")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setErr(null)
    const res = await apiSend(`/api/jobs/${jobId}/checklist/${item.id}/assign`, "POST", {
      assigneeIds: sel ? [sel] : [],
    })
    setBusy(false)
    if (!res.ok) return setErr(res.error)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
        aria-label="Assign task to"
      >
        <option value="">Unassigned</option>
        {cleaners.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={busy || sel === (item.assignedToId ?? "")}
        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Assign"}
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
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
