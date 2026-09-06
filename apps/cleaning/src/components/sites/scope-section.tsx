"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, Textarea, StatusPill, EmptyState } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type ChecklistItem = { label: string; instructions?: string | null; isRequired: boolean; requirePhoto: boolean }
export type ChecklistTemplate = {
  id: string
  name: string
  description: string | null
  version: number
  isActive: boolean
  items: ChecklistItem[]
}

const emptyItem = (): ChecklistItem => ({ label: "", instructions: "", isRequired: true, requirePhoto: false })

function ScopeForm({ initial, onDone }: { initial?: ChecklistTemplate; onDone: () => void }) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [items, setItems] = useState<ChecklistItem[]>(initial?.items?.length ? initial.items : [emptyItem()])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const patchItem = (i: number, patch: Partial<ChecklistItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = items.filter((it) => it.label.trim())
    if (cleaned.length === 0) return setError("Add at least one checklist item")
    setSaving(true)
    setError(null)
    const payload = { name, description, items: cleaned }
    const res = initial
      ? await apiSend(`/api/checklist-templates/${initial.id}`, "PATCH", payload)
      : await apiSend("/api/checklist-templates", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Checklist name" htmlFor="sc-name" hint="e.g. Standard nightly office clean">
        <Input id="sc-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="sc-desc">
        <Textarea id="sc-desc" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Checklist items</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => setItems((a) => [...a, emptyItem()])}>
            Add item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 text-xs text-slate-400">{i + 1}.</span>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Task (e.g. Empty all trash and replace liners)"
                    value={it.label}
                    onChange={(e) => patchItem(i, { label: e.target.value })}
                  />
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={it.isRequired} onChange={(e) => patchItem(i, { isRequired: e.target.checked })} />
                      Required
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={it.requirePhoto} onChange={(e) => patchItem(i, { requirePhoto: e.target.checked })} />
                      Photo required
                    </label>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
                        className="ml-auto text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save checklist" : "Create checklist"}
        </Button>
      </div>
    </form>
  )
}

export function ScopeSection({ templates }: { templates: ChecklistTemplate[] }) {
  const [dialog, setDialog] = useState<{ mode: "new" } | { mode: "edit"; tpl: ChecklistTemplate } | null>(null)

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Scope of work — checklists</h2>
        <Button size="sm" onClick={() => setDialog({ mode: "new" })}>
          New checklist
        </Button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Reusable checklists define what must be done. Jobs snapshot these, so editing a checklist never changes
        already-completed work.
      </p>
      {templates.length === 0 ? (
        <EmptyState title="No checklists yet">Define the scope of work for this customer&apos;s sites.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{t.name}</span>
                  <span className="text-xs text-slate-400">v{t.version}</span>
                  <StatusPill active={t.isActive} />
                </div>
                <div className="text-xs text-slate-500">{t.items.length} item{t.items.length === 1 ? "" : "s"}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: "edit", tpl: t })}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.mode === "edit" ? "Edit checklist" : "New checklist"}
      >
        {dialog ? <ScopeForm initial={dialog.mode === "edit" ? dialog.tpl : undefined} onDone={() => setDialog(null)} /> : null}
      </Modal>
    </Card>
  )
}
