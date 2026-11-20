"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { apiSend } from "@/lib/client"
import { EMPLOYEE_REPORT_CATEGORIES } from "@/lib/zod-schemas"
import { categoryLabel, CATEGORY_DEFAULT_TIER, CONFIDENTIALITY_META } from "@/lib/employee-reports/labels"

// Mobile quick-report from the job/checklist screen (P2). A cleaner reports a
// work-quality, operational, or confidential concern in a few taps. Confidential
// reports route privately to authorized management — never to coworkers.
export function ReportConcern({
  jobId,
  checklist,
  presetItemId,
}: {
  jobId: string
  checklist: { id: string; label: string }[]
  presetItemId?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>("INCOMPLETE_WORK")
  const [itemId, setItemId] = useState(presetItemId ?? "")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const tier = CATEGORY_DEFAULT_TIER[category] ?? "NORMAL"
  const tierMeta = CONFIDENTIALITY_META[tier]

  function reset() {
    setCategory("INCOMPLETE_WORK")
    setItemId(presetItemId ?? "")
    setDescription("")
    setError(null)
    setDone(false)
  }
  function close() {
    setOpen(false)
    reset()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await apiSend("/api/employee-reports", "POST", {
      category,
      confidentiality: tier,
      description,
      jobId,
      jobChecklistItemId: itemId || null,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(true)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700 active:bg-slate-50"
      >
        Report a work or workplace concern
      </button>
      <Modal open={open} onClose={close} title="Report a concern">
        {done ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Report submitted. {tier === "CONFIDENTIAL" ? "It was routed privately to authorized management." : "Management will review it."}
            </p>
            <div className="flex justify-end">
              <button onClick={close} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {EMPLOYEE_REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{categoryLabel(c)}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Handled as <span className={`rounded px-1.5 py-0.5 font-medium ${tierMeta.cls}`}>{tierMeta.label}</span>
                {tier === "CONFIDENTIAL" ? " — visible only to authorized management." : null}
              </p>
            </div>
            {checklist.length > 0 ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Related task (optional)</label>
                <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">None</option>
                  {checklist.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
                </select>
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">What happened?</label>
              <textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand" />
            </div>
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busy || !description.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit"}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
