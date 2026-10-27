"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { SOP_CATEGORIES } from "@/lib/zod-schemas"

type Opt = { id: string; name: string }
type Section = { heading: string; body: string }
export type SopEditValue = {
  title: string; category: string; keywords: string; attachmentUrl: string
  requiresAck: boolean; reackIntervalDays: string
  appliesEveryone: boolean; appliesRoles: string[]; appliesSiteIds: string[]; appliesServicePlanIds: string[]
  sections: Section[]
}
const ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CLEANER"]
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")
const EMPTY: SopEditValue = { title: "", category: "SAFETY", keywords: "", attachmentUrl: "", requiresAck: false, reackIntervalDays: "", appliesEveryone: true, appliesRoles: [], appliesSiteIds: [], appliesServicePlanIds: [], sections: [{ heading: "", body: "" }] }

export function SopEditor({ mode, sopId, initial, sites, plans }: { mode: "new" | "edit"; sopId?: string; initial?: SopEditValue; sites: Opt[]; plans: Opt[] }) {
  const router = useRouter()
  const [v, setV] = useState<SopEditValue>(initial ?? EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof SopEditValue>(k: K, val: SopEditValue[K]) => { setV((p) => ({ ...p, [k]: val })); setError(null) }
  const toggle = (k: "appliesRoles" | "appliesSiteIds" | "appliesServicePlanIds", id: string) =>
    set(k, v[k].includes(id) ? v[k].filter((x) => x !== id) : [...v[k], id])

  function setSection(i: number, patch: Partial<Section>) { set("sections", v.sections.map((s, j) => (j === i ? { ...s, ...patch } : s))) }
  function addSection() { set("sections", [...v.sections, { heading: "", body: "" }]) }
  function removeSection(i: number) { set("sections", v.sections.filter((_, j) => j !== i)) }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= v.sections.length) return
    const next = [...v.sections]; [next[i], next[j]] = [next[j]!, next[i]!]; set("sections", next)
  }

  async function save() {
    if (!v.title.trim()) return setError("Title is required")
    if (v.sections.some((s) => !s.heading.trim() || !s.body.trim())) return setError("Every section needs a heading and body")
    setBusy(true); setError(null)
    const payload = {
      title: v.title, category: v.category, keywords: v.keywords || undefined, attachmentUrl: v.attachmentUrl || undefined,
      requiresAck: v.requiresAck, reackIntervalDays: v.reackIntervalDays ? Number(v.reackIntervalDays) : null,
      appliesEveryone: v.appliesEveryone, appliesRoles: v.appliesEveryone ? [] : v.appliesRoles,
      appliesSiteIds: v.appliesEveryone ? [] : v.appliesSiteIds, appliesServicePlanIds: v.appliesEveryone ? [] : v.appliesServicePlanIds,
      sections: v.sections,
    }
    const res = mode === "new" ? await apiSend<{ id: string }>("/api/sops", "POST", payload) : await apiSend(`/api/sops/${sopId}`, "PATCH", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    const id = mode === "new" ? (res.data as { id: string }).id : sopId
    router.push(`/sops/${id}`)
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Title" htmlFor="s-title"><Input id="s-title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Chemical spill response" /></Field>
          <Field label="Category" htmlFor="s-cat"><Select id="s-cat" value={v.category} onChange={(e) => set("category", e.target.value)}>{SOP_CATEGORIES.map((c) => <option key={c} value={c}>{titleize(c)}</option>)}</Select></Field>
          <Field label="Keywords" htmlFor="s-kw" hint="searched alongside the content"><Input id="s-kw" value={v.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="spill, containment, PPE" /></Field>
          <Field label="Attachment link (optional)" htmlFor="s-att" hint="PDF / diagram / SDS; content below is what's searched"><Input id="s-att" value={v.attachmentUrl} onChange={(e) => set("attachmentUrl", e.target.value)} placeholder="https://…" /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Who it applies to</h3>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={v.appliesEveryone} onChange={(e) => set("appliesEveryone", e.target.checked)} /> Everyone</label>
        {!v.appliesEveryone ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Roles</div>
              {ROLES.map((r) => <label key={r} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={v.appliesRoles.includes(r)} onChange={() => toggle("appliesRoles", r)} /> {titleize(r)}</label>)}
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Sites</div>
              <div className="max-h-40 overflow-y-auto">{sites.map((s) => <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={v.appliesSiteIds.includes(s.id)} onChange={() => toggle("appliesSiteIds", s.id)} /> {s.name}</label>)}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Service plans</div>
              <div className="max-h-40 overflow-y-auto">{plans.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={v.appliesServicePlanIds.includes(p.id)} onChange={() => toggle("appliesServicePlanIds", p.id)} /> {p.name}</label>)}</div>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Acknowledgment</h3>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={v.requiresAck} onChange={(e) => set("requiresAck", e.target.checked)} /> Require staff to acknowledge they have read this</label>
        {v.requiresAck ? (
          <div className="mt-2 w-56"><Field label="Re-acknowledge every (days)" htmlFor="s-reack" hint="blank = only on a new version"><Input id="s-reack" type="number" min={1} value={v.reackIntervalDays} onChange={(e) => set("reackIntervalDays", e.target.value)} placeholder="365" /></Field></div>
        ) : null}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Sections <span className="text-slate-400">(the unit of search)</span></h3>
          <Button size="sm" variant="secondary" onClick={addSection}>Add section</Button>
        </div>
        <div className="space-y-4">
          {v.sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">#{i + 1}</span>
                <Input value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} placeholder="Section heading (e.g. Step 4: Containment)" className="flex-1" />
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === v.sections.length - 1} className="rounded px-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => removeSection(i)} disabled={v.sections.length === 1} className="rounded px-1.5 text-red-500 hover:text-red-700 disabled:opacity-30" aria-label="Remove">✕</button>
              </div>
              <Textarea value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} placeholder="Section body…" rows={4} />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : mode === "new" ? "Create draft" : "Save draft"}</Button>
        <Button variant="secondary" onClick={() => router.push(mode === "new" ? "/sops" : `/sops/${sopId}`)}>Cancel</Button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
