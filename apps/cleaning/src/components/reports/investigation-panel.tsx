"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"
import { isAllegation } from "@/lib/employee-reports/workflow"
import { categoryLabel, CONFIDENTIALITY_META, STATUS_META } from "@/lib/employee-reports/labels"

type Named = { id: string; name: string }
type ReportDto = {
  id: string
  category: string
  confidentiality: string
  status: string
  outcome: string | null
  title: string | null
  description: string
  subjectName: string | null
  reporterName: string | null
  reviewerName: string | null
  reviewerId: string | null
  finding: string | null
  employeeResponse: string | null
  correctiveAction: string | null
  correctiveAssigneeName: string | null
  correctiveDueAt: string | null
  jobId: string | null
  jobTitle: string | null
  checklistLabel: string | null
  createdAt: string
  photos: { id: string }[]
}
type HistoryDto = { id: string; action: string; createdAt: string; oldValue: string | null; newValue: string | null }

function Badge({ meta }: { meta: { label: string; cls: string } }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function InvestigationPanel({
  report,
  history,
  canInvestigate,
  reviewers,
  assignees,
}: {
  report: ReportDto
  history: HistoryDto[]
  canInvestigate: boolean
  reviewers: Named[]
  assignees: Named[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [reviewer, setReviewer] = useState(report.reviewerId ?? "")
  const [note, setNote] = useState("")
  const [response, setResponse] = useState("")
  const [corrective, setCorrective] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [assignee, setAssignee] = useState("")

  const s = report.status
  const allegation = isAllegation(s as never)
  const substantiated = report.outcome === "SUBSTANTIATED"
  const resolved = s === "RESOLVED"

  async function send(path: string, body?: unknown) {
    setBusy(true)
    setErr(null)
    const res = await apiSend(`/api/employee-reports/${report.id}${path}`, "POST", body)
    setBusy(false)
    if (!res.ok) return setErr(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">{categoryLabel(report.category)}</h1>
          <Badge meta={CONFIDENTIALITY_META[report.confidentiality] ?? CONFIDENTIALITY_META.NORMAL} />
          <Badge meta={STATUS_META[s] ?? STATUS_META.SUBMITTED} />
        </div>
        {report.title ? <p className="mt-1 text-sm font-medium text-slate-700">{report.title}</p> : null}
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
          <div>Filed by {report.reporterName ?? "unknown"} · {fmt(report.createdAt)}</div>
          <div>{report.subjectName ? <>About {report.subjectName}</> : "No named subject"}</div>
          {report.reviewerName ? <div>Reviewer: {report.reviewerName}</div> : null}
          {report.jobId ? (
            <div>
              Job: <a className="text-brand hover:underline" href={`/jobs/${report.jobId}`}>{report.jobTitle ?? "view"}</a>
              {report.checklistLabel ? <> · {report.checklistLabel}</> : null}
            </div>
          ) : null}
        </dl>
      </div>

      {allegation ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          This is an allegation under review. It does not count against anyone unless it is investigated and substantiated.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Report</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>
        {report.photos.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {report.photos.map((p) => (
              <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- tenant-scoped, access-gated evidence */}
                <img src={`/api/photos/${p.id}`} alt="Evidence" className="aspect-square w-full rounded-lg object-cover" />
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {(report.finding || report.employeeResponse || report.correctiveAction) && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          {report.finding ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Investigation findings</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{report.finding}</p>
            </div>
          ) : null}
          {report.employeeResponse ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employee response</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{report.employeeResponse}</p>
            </div>
          ) : null}
          {report.correctiveAction ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Corrective action</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{report.correctiveAction}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {report.correctiveAssigneeName ? <>Assigned to {report.correctiveAssigneeName}</> : null}
                {report.correctiveDueAt ? <> · due {fmt(report.correctiveDueAt)}</> : null}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {canInvestigate ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Investigation</h2>

          {(s === "SUBMITTED" || s === "PENDING_REVIEW") && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">
                Assign reviewer
                <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="">Select…</option>
                  {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <button disabled={busy || !reviewer} onClick={() => send("/assign", { reviewerId: reviewer })} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50">Assign</button>
            </div>
          )}

          {s === "PENDING_REVIEW" && (
            <button disabled={busy} onClick={() => send("/status", { action: "start_review" })} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Start review</button>
          )}

          {(s === "UNDER_REVIEW" || (!allegation && !resolved)) && (
            <div className="space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Findings / notes (recorded with your decision)" className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              {s === "UNDER_REVIEW" ? (
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => send("/status", { action: "substantiate", note })} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Substantiated</button>
                  <button disabled={busy} onClick={() => send("/status", { action: "unsubstantiate", note })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Unsubstantiated</button>
                  <button disabled={busy} onClick={() => send("/status", { action: "inconclusive", note })} className="rounded-lg bg-slate-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Inconclusive</button>
                </div>
              ) : null}
            </div>
          )}

          {!allegation && !resolved && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="block text-xs text-slate-600">Record employee response (solicited by management)</label>
              <textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="What the employee said when asked" className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button disabled={busy || !response.trim()} onClick={() => send("/response", { response })} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50">Save response</button>
            </div>
          )}

          {substantiated && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="block text-xs text-slate-600">Corrective action / follow-up work</label>
              <textarea value={corrective} onChange={(e) => setCorrective(e.target.value)} placeholder="Correction requested or follow-up work to assign" className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-600">Due
                  <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs text-slate-600">Assign to
                  <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                    <option value="">Nobody</option>
                    {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <button disabled={busy || !corrective.trim()} onClick={() => send("/corrective", { action: corrective, dueAt: dueAt ? new Date(dueAt).toISOString() : null, assigneeId: assignee || null })} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save corrective action</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {!allegation && !resolved ? (
              <button disabled={busy} onClick={() => send("/status", { action: "resolve" })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Resolve</button>
            ) : null}
            {(!allegation || resolved) ? (
              <button disabled={busy} onClick={() => send("/status", { action: "reopen" })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-50">Reopen</button>
            ) : null}
          </div>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          You can view this report but cannot investigate it (you filed it or it concerns you).
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">History</h2>
        <ul className="space-y-1.5">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between text-xs text-slate-500">
              <span>{h.action.replace("report.", "")}{h.newValue ? ` → ${h.newValue}` : ""}</span>
              <span className="text-slate-400">{fmt(h.createdAt)}</span>
            </li>
          ))}
          {history.length === 0 ? <li className="text-xs text-slate-400">No recorded actions yet.</li> : null}
        </ul>
      </div>
    </div>
  )
}
