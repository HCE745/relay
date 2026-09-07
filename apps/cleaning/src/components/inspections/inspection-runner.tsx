"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

export type ResultItem = {
  id: string
  label: string
  instructions: string | null
  points: number
  isCritical: boolean
  requirePhoto: boolean
  result: "PASS" | "FAIL" | "NA" | null
  note: string | null
  hasPhoto: boolean
}

const VALUES: Array<{ v: "PASS" | "FAIL" | "NA"; label: string; on: string }> = [
  { v: "PASS", label: "Pass", on: "bg-emerald-600 text-white" },
  { v: "FAIL", label: "Fail", on: "bg-red-600 text-white" },
  { v: "NA", label: "N/A", on: "bg-slate-500 text-white" },
]

export function InspectionRunner(props: {
  inspectionId: string
  jobId: string | null
  templateName: string
  passThreshold: number
  siteName: string
  customerName: string
  canEdit: boolean
  results: ResultItem[]
}) {
  const router = useRouter()
  const [comments, setComments] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unmet, setUnmet] = useState<string[] | null>(null)

  async function finalize() {
    setBusy(true)
    setError(null)
    setUnmet(null)
    const res = await apiSend<{ outcome: string; score: number }>(`/api/inspections/${props.inspectionId}/finalize`, "POST", { comments })
    setBusy(false)
    if (!res.ok) {
      if (res.unmet?.length) setUnmet(res.unmet)
      else setError(res.error)
      return
    }
    router.refresh()
  }

  const scored = props.results.filter((r) => r.result !== null).length

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-lg font-semibold text-slate-900">{props.templateName}</div>
        <div className="text-sm text-slate-500">
          {props.customerName} · {props.siteName}
        </div>
        <div className="mt-1 text-xs text-slate-400">Passing threshold: {props.passThreshold}%</div>
      </div>

      <div className="space-y-2">
        {props.results.map((it) => (
          <ItemRow key={it.id} inspectionId={props.inspectionId} item={it} disabled={!props.canEdit} />
        ))}
      </div>

      {props.canEdit ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Overall comments</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {unmet ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Finish before finalizing:</p>
          <ul className="mt-1 list-disc pl-5">
            {unmet.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.canEdit ? (
        <button
          onClick={finalize}
          disabled={busy || scored < props.results.length}
          className="w-full rounded-2xl bg-brand py-4 text-center text-base font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Finalizing…" : scored < props.results.length ? `Score all items (${scored}/${props.results.length})` : "Finalize inspection"}
        </button>
      ) : null}
    </div>
  )
}

function ItemRow({ inspectionId, item, disabled }: { inspectionId: string; item: ResultItem; disabled: boolean }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function setResult(v: "PASS" | "FAIL" | "NA") {
    if (disabled) return
    setBusy(true)
    await apiSend(`/api/inspections/${inspectionId}/items/${item.id}`, "PATCH", { result: v })
    setBusy(false)
    router.refresh()
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const form = new FormData()
    form.append("file", file)
    form.append("inspectionItemResultId", item.id)
    await fetch(`/api/inspections/${inspectionId}/photos`, { method: "POST", body: form })
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">
            {item.label}
            {item.isCritical ? <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">critical</span> : null}
            <span className="ml-1 text-xs text-slate-400">({item.points} pt)</span>
          </div>
          {item.instructions ? <div className="text-xs text-slate-500">{item.instructions}</div> : null}
        </div>
      </div>
      <div className="mt-2 flex gap-1.5">
        {VALUES.map((o) => (
          <button
            key={o.v}
            onClick={() => setResult(o.v)}
            disabled={disabled || busy}
            className={`flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-50 ${
              item.result === o.v ? o.on : "bg-slate-100 text-slate-600"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {item.requirePhoto && item.result !== "NA" ? (
        <div className="mt-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={upload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled || busy}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${item.hasPhoto ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
          >
            {item.hasPhoto ? "Photo added ✓" : "Add required photo"}
          </button>
        </div>
      ) : null}
    </div>
  )
}
