"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"
import { Card } from "@/components/ui/controls"
import { OUTCOME_LABELS, RESPONSIBILITY_BASIS_LABELS, type ComplaintOutcome, type ResponsibilityBasis } from "@/lib/complaints/investigation"

type Responsibility = {
  id: string
  userName: string
  basis: ResponsibilityBasis
  taskLabel: string | null
  verificationStatus: string | null
}
type CorrectiveWO = { id: string; status: string; assigneeName: string | null } | null

export type ComplaintDto = {
  issueId: string
  status: string
  outcome: ComplaintOutcome | null
  finding: string | null
  investigatedByName: string | null
  linkedTaskId: string | null
  jobTaskOptions: { id: string; label: string }[]
  responsibilities: Responsibility[]
  corrective: CorrectiveWO
  assignableUsers: { id: string; name: string }[]
}

const OUTCOME_STYLE: Record<string, string> = {
  SUBSTANTIATED: "bg-red-600",
  UNSUBSTANTIATED: "bg-emerald-600",
  INCONCLUSIVE: "bg-slate-500",
}

// Management investigation panel for a customer complaint (P3). Rendered on the
// issue detail page only when the issue's source is CUSTOMER. Employees never see
// this surface — they only ever receive a neutral corrective-work assignment.
export function ComplaintInvestigation({ dto }: { dto: ComplaintDto }) {
  const router = useRouter()
  const closed = dto.status === "CLOSED"
  const isAllegation = !dto.outcome

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(path: string, body: unknown) {
    setBusy(true)
    setError(null)
    const res = await apiSend(`/api/issues/${dto.issueId}${path}`, "POST", body)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  // Outcome form
  const [finding, setFinding] = useState(dto.finding ?? "")
  function recordOutcome(outcome: ComplaintOutcome) {
    void send("/outcome", { outcome, finding })
  }

  // Corrective form
  const [cAssignee, setCAssignee] = useState("")
  const [cDesc, setCDesc] = useState("")
  const [cDue, setCDue] = useState("")
  const [cBillable, setCBillable] = useState(false)
  function createCorrective(e: React.FormEvent) {
    e.preventDefault()
    void send("/corrective", {
      assigneeId: cAssignee || null,
      description: cDesc,
      dueAt: cDue ? new Date(cDue).toISOString() : null,
      billable: cBillable,
    })
  }

  return (
    <Card className="space-y-5 border-indigo-200 bg-indigo-50/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-indigo-900">Complaint investigation</h2>
        {dto.outcome ? (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${OUTCOME_STYLE[dto.outcome]}`}>
            {OUTCOME_LABELS[dto.outcome]}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Allegation — under review</span>
        )}
      </div>

      {isAllegation ? (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
          A customer complaint is an <strong>allegation</strong> until it is investigated. It does not count against any employee&apos;s
          record, and only a <strong>substantiated</strong> finding may ever contribute to performance.
        </p>
      ) : null}

      {/* Link the specific task the complaint is about */}
      {dto.jobTaskOptions.length > 0 ? (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Task this is about</label>
          <select
            value={dto.linkedTaskId ?? ""}
            disabled={busy}
            onChange={(e) => void send("/complaint-task", { jobChecklistItemId: e.target.value || null })}
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Not task-specific</option>
            {dto.jobTaskOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">Linking a task records who was responsible for it — preserved as history.</p>
        </div>
      ) : null}

      {/* Responsibility snapshot (read-only, immutable) */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Responsible at the time (preserved)</div>
        {dto.responsibilities.length === 0 ? (
          <p className="text-sm text-slate-400">No responsibility captured yet{dto.jobTaskOptions.length ? " — link a task or record an outcome to capture it." : "."}</p>
        ) : (
          <ul className="space-y-1">
            {dto.responsibilities.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span className="font-medium">{r.userName}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{RESPONSIBILITY_BASIS_LABELS[r.basis]}</span>
                {r.taskLabel ? <span className="text-xs text-slate-400">{r.taskLabel}</span> : null}
                {r.verificationStatus ? <span className="text-xs text-slate-400">· {r.verificationStatus.toLowerCase().replace(/_/g, " ")}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Record / revise the outcome */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {dto.outcome ? "Revise finding" : "Record finding"}
        </div>
        <textarea
          value={finding}
          onChange={(e) => setFinding(e.target.value)}
          disabled={closed}
          placeholder="What the investigation found (optional note, kept internal)…"
          className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-slate-50"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {(["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE"] as ComplaintOutcome[]).map((o) => (
            <button
              key={o}
              disabled={busy || closed}
              onClick={() => recordOutcome(o)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${OUTCOME_STYLE[o]}`}
            >
              {OUTCOME_LABELS[o]}
            </button>
          ))}
        </div>
        {dto.investigatedByName ? <p className="mt-1 text-xs text-slate-400">Last reviewed by {dto.investigatedByName}.</p> : null}
        {closed ? <p className="mt-1 text-xs text-slate-400">This complaint is closed; reopen it to change the finding.</p> : null}
      </div>

      {/* Corrective work */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Corrective work</div>
        {dto.corrective ? (
          <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700">
            Corrective work order · <span className="font-medium">{dto.corrective.status}</span>
            {dto.corrective.assigneeName ? ` · ${dto.corrective.assigneeName}` : " · unassigned"}
            <p className="mt-1 text-xs text-slate-500">Track rework to completion and verification in Work orders.</p>
          </div>
        ) : (
          <form onSubmit={createCorrective} className="space-y-2">
            <input
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              placeholder="What rework is needed (kept neutral — the assignee won't see the complaint)…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <select value={cAssignee} onChange={(e) => setCAssignee(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Assign later</option>
                {dto.assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="date" value={cDue} onChange={(e) => setCDue(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={cBillable} onChange={(e) => setCBillable(e.target.checked)} /> Billable
              </label>
              <button type="submit" disabled={busy || !cDesc.trim()} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {busy ? "Creating…" : "Create corrective work"}
              </button>
            </div>
            <p className="text-xs text-slate-500">The assignee is notified neutrally — no accusation or customer detail is shared.</p>
          </form>
        )}
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </Card>
  )
}
