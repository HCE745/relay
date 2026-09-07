"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type ItemDraft = { label: string; points: string; isCritical: boolean; requirePhoto: boolean }
const emptyItem = (): ItemDraft => ({ label: "", points: "1", isCritical: false, requirePhoto: false })

export function NewTemplateButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [threshold, setThreshold] = useState("80")
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const patch = (i: number, p: Partial<ItemDraft>) => setItems((a) => a.map((it, idx) => (idx === i ? { ...it, ...p } : it)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = items.filter((it) => it.label.trim()).map((it) => ({
      label: it.label,
      points: Number(it.points) || 1,
      isCritical: it.isCritical,
      requirePhoto: it.requirePhoto,
    }))
    if (!cleaned.length) return setError("Add at least one item")
    setBusy(true)
    setError(null)
    const res = await apiSend("/api/inspection-templates", "POST", { name, passThreshold: Number(threshold), items: cleaned })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    setItems([emptyItem()])
    setName("")
    router.refresh()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New template</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New inspection template">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Template name" htmlFor="t-name">
                <Input id="t-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <Field label="Pass %" htmlFor="t-thr">
              <Input id="t-thr" type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Items</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setItems((a) => [...a, emptyItem()])}>
                Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <Input placeholder="What is being checked?" value={it.label} onChange={(e) => patch(i, { label: e.target.value })} />
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <label className="flex items-center gap-1">
                      Points
                      <input
                        type="number"
                        min={0}
                        value={it.points}
                        onChange={(e) => patch(i, { points: e.target.value })}
                        className="w-14 rounded border border-slate-300 px-1.5 py-0.5"
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={it.isCritical} onChange={(e) => patch(i, { isCritical: e.target.checked })} />
                      Critical
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={it.requirePhoto} onChange={(e) => patch(i, { requirePhoto: e.target.checked })} />
                      Photo
                    </label>
                    {items.length > 1 ? (
                      <button type="button" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} className="ml-auto text-red-600">
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create template"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
