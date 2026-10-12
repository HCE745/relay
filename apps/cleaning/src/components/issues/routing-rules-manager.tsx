"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES, ISSUE_SOURCES } from "@/lib/zod-schemas"

type Option = { id: string; name: string }
type SiteOption = { id: string; name: string; customerName: string }
export type RuleRow = {
  id: string
  name: string
  priority: number
  isActive: boolean
  category: string | null
  severity: string | null
  source: string | null
  serviceLocationId: string | null
  assignTo: { id: string; name: string | null; isActive: boolean }
  serviceLocation: { id: string; name: string } | null
}

const ANY = "" // empty select value = "matches any"
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
const blank = { name: "", priority: "100", isActive: true, category: ANY, severity: ANY, source: ANY, serviceLocationId: ANY, assignToId: "" }

export function RoutingRulesManager({ rules, users, sites, defaultAssigneeId }: { rules: RuleRow[]; users: Option[]; sites: SiteOption[]; defaultAssigneeId: string | null }) {
  const router = useRouter()
  const [form, setForm] = useState({ ...blank })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof blank, v: string | boolean) => { setForm((f) => ({ ...f, [k]: v })); setError(null) }

  function startEdit(r: RuleRow) {
    setEditingId(r.id)
    setForm({ name: r.name, priority: String(r.priority), isActive: r.isActive, category: r.category ?? ANY, severity: r.severity ?? ANY, source: r.source ?? ANY, serviceLocationId: r.serviceLocationId ?? ANY, assignToId: r.assignTo.id })
    setError(null)
  }
  function cancelEdit() { setEditingId(null); setForm({ ...blank }); setError(null) }

  async function submit() {
    if (!form.name.trim()) return setError("Name the rule")
    if (!form.assignToId) return setError("Choose who it routes to")
    setBusy(true); setError(null)
    const payload = { ...form, priority: Number(form.priority) }
    const res = editingId
      ? await apiSend(`/api/issues/routing/${editingId}`, "PATCH", payload)
      : await apiSend("/api/issues/routing", "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    cancelEdit(); router.refresh()
  }

  async function remove(id: string) {
    if (!confirm("Delete this routing rule?")) return
    const res = await apiSend(`/api/issues/routing/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    if (editingId === id) cancelEdit()
    router.refresh()
  }

  async function toggleActive(r: RuleRow) {
    const res = await apiSend(`/api/issues/routing/${r.id}`, "PATCH", { name: r.name, priority: r.priority, isActive: !r.isActive, category: r.category, severity: r.severity, source: r.source, serviceLocationId: r.serviceLocationId, assignToId: r.assignTo.id })
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  const cond = (r: RuleRow) => {
    const parts = [r.category, r.severity, r.source].filter(Boolean).map((x) => titleCase(x as string))
    if (r.serviceLocation) parts.push(`@ ${r.serviceLocation.name}`)
    return parts.length ? parts.join(" · ") : "Any issue"
  }

  return (
    <div className="space-y-6">
      <DefaultOwnerForm users={users} current={defaultAssigneeId} />

      <Card className="overflow-x-auto">
        {rules.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No routing rules yet. New issues fall through to the default owner (set in Settings), otherwise they stay unassigned.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Rule</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Routes to</th>
                <th className="px-4 py-2.5 font-medium">Active</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400">{r.priority}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{cond(r)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.assignTo.name}{r.assignTo.isActive ? "" : <span className="ml-1 text-xs text-red-500">(inactive)</span>}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <input type="checkbox" checked={r.isActive} onChange={() => toggleActive(r)} /> {r.isActive ? "On" : "Off"}
                    </label>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(r)} className="mr-3 text-sm font-medium text-brand hover:underline">Edit</button>
                    <button onClick={() => remove(r.id)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">{editingId ? "Edit rule" : "Add a routing rule"}</h3>
        <p className="mb-4 text-xs text-slate-500">Rules are checked in priority order (low number first). The first match assigns the owner. Leave a condition on &ldquo;Any&rdquo; to ignore it.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Rule name" htmlFor="rr-name"><Input id="rr-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Safety issues → site supervisor" /></Field>
          <Field label="Priority" htmlFor="rr-pri" hint="lower runs first"><Input id="rr-pri" type="number" min={1} max={9999} value={form.priority} onChange={(e) => set("priority", e.target.value)} /></Field>
          <Field label="Category" htmlFor="rr-cat"><Select id="rr-cat" value={form.category} onChange={(e) => set("category", e.target.value)}><option value={ANY}>Any</option>{ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
          <Field label="Severity" htmlFor="rr-sev"><Select id="rr-sev" value={form.severity} onChange={(e) => set("severity", e.target.value)}><option value={ANY}>Any</option>{ISSUE_SEVERITIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
          <Field label="Source" htmlFor="rr-src"><Select id="rr-src" value={form.source} onChange={(e) => set("source", e.target.value)}><option value={ANY}>Any</option>{ISSUE_SOURCES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
          <Field label="Site" htmlFor="rr-site"><Select id="rr-site" value={form.serviceLocationId} onChange={(e) => set("serviceLocationId", e.target.value)}><option value={ANY}>Any site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.customerName} · {s.name}</option>)}</Select></Field>
          <Field label="Route to" htmlFor="rr-to"><Select id="rr-to" value={form.assignToId} onChange={(e) => set("assignToId", e.target.value)}><option value="">Choose a person…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <label className="flex items-end gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : editingId ? "Save rule" : "Add rule"}</Button>
          {editingId ? <Button variant="secondary" onClick={cancelEdit}>Cancel</Button> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>

      <RoutingPreview sites={sites} />
    </div>
  )
}

function DefaultOwnerForm({ users, current }: { users: Option[]; current: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/issues/routing/default", "PATCH", { defaultIssueAssigneeId: value })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <Card className="p-6">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Default owner (fallback)</h3>
      <p className="mb-4 text-xs text-slate-500">When no rule matches, new issues go here. Leave unset to keep them unassigned for manual triage.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <Field label="Default owner" htmlFor="rr-default">
            <Select id="rr-default" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false) }}>
              <option value="">Leave unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        </div>
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save default"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </Card>
  )
}

function RoutingPreview({ sites }: { sites: SiteOption[] }) {
  const [p, setP] = useState({ category: "OTHER", severity: "MEDIUM", source: "STAFF", serviceLocationId: "" })
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true); setResult(null)
    const res = await apiSend<{ assignToId: string | null; ruleName: string | null; reason: string }>("/api/issues/routing/preview", "POST", p)
    setBusy(false)
    if (!res.ok) return setResult(`Error: ${res.error}`)
    const d = res.data
    if (d.reason === "rule" && d.assignToId) setResult(`Matches rule “${d.ruleName}” → assigned.`)
    else if (d.reason === "rule" && !d.assignToId) setResult(`Matches rule “${d.ruleName}”, but its owner is inactive → left unassigned.`)
    else if (d.reason === "default") setResult("No rule matched → default owner.")
    else setResult("No rule matched and no default owner → stays unassigned.")
  }

  return (
    <Card className="p-6">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Test routing (dry run)</h3>
      <p className="mb-4 text-xs text-slate-500">See where a hypothetical issue would go. Nothing is created.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Category" htmlFor="pv-cat"><Select id="pv-cat" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}>{ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
        <Field label="Severity" htmlFor="pv-sev"><Select id="pv-sev" value={p.severity} onChange={(e) => setP({ ...p, severity: e.target.value })}>{ISSUE_SEVERITIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
        <Field label="Source" htmlFor="pv-src"><Select id="pv-src" value={p.source} onChange={(e) => setP({ ...p, source: e.target.value })}>{ISSUE_SOURCES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></Field>
        <Field label="Site" htmlFor="pv-site"><Select id="pv-site" value={p.serviceLocationId} onChange={(e) => setP({ ...p, serviceLocationId: e.target.value })}><option value="">Any site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.customerName} · {s.name}</option>)}</Select></Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="secondary" onClick={run} disabled={busy}>{busy ? "Checking…" : "Test"}</Button>
        {result ? <span className="text-sm text-slate-700">{result}</span> : null}
      </div>
    </Card>
  )
}
