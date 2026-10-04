"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { CREDENTIAL_TYPES, CREDENTIAL_STATUSES } from "@/lib/zod-schemas"
import { CREDENTIAL_TYPE_LABELS } from "@/lib/credential-status"

type Member = { id: string; name: string }
type Cred = { id: string; userId: string; userName: string; type: string; issueDate: string | null; expiryDate: string | null; status: string; state: string; documentRef: string | null }
type Site = { id: string; name: string; requiredTypes: string[] }

const STATE_TONE: Record<string, BadgeTone> = { ACTIVE: "success", EXPIRING: "warning", EXPIRED: "danger", REVOKED: "neutral" }
const STATE_LABEL: Record<string, string> = { ACTIVE: "Active", EXPIRING: "Expiring", EXPIRED: "Expired", REVOKED: "Revoked" }
const fmtD = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

function AddCredential({ members }: { members: Member[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({ userId: members[0]?.id ?? "", type: CREDENTIAL_TYPES[0] as string, issueDate: "", expiryDate: "", documentRef: "", status: "ACTIVE" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value })

  async function save() {
    setBusy(true); setError(null)
    const res = await apiSend("/api/credentials", "POST", {
      userId: v.userId, type: v.type, issueDate: v.issueDate || undefined, expiryDate: v.expiryDate || undefined,
      documentRef: v.documentRef || undefined, status: v.status,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false); setV({ ...v, issueDate: "", expiryDate: "", documentRef: "" })
    router.refresh()
  }

  if (!open) return <Button onClick={() => setOpen(true)}>Add credential</Button>
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Employee" htmlFor="c-user"><Select id="c-user" value={v.userId} onChange={set("userId")}>{members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}</Select></Field>
        <Field label="Type" htmlFor="c-type"><Select id="c-type" value={v.type} onChange={set("type")}>{CREDENTIAL_TYPES.map((t) => (<option key={t} value={t}>{CREDENTIAL_TYPE_LABELS[t]}</option>))}</Select></Field>
        <Field label="Status" htmlFor="c-status"><Select id="c-status" value={v.status} onChange={set("status")}>{CREDENTIAL_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}</Select></Field>
        <Field label="Issued" htmlFor="c-iss"><Input id="c-iss" type="date" value={v.issueDate} onChange={set("issueDate")} /></Field>
        <Field label="Expires" htmlFor="c-exp"><Input id="c-exp" type="date" value={v.expiryDate} onChange={set("expiryDate")} /></Field>
        <Field label="Document ref" htmlFor="c-doc"><Input id="c-doc" value={v.documentRef} onChange={set("documentRef")} placeholder="URL or note" /></Field>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button onClick={save} disabled={busy || !v.userId}>{busy ? "Saving…" : "Save"}</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  )
}

function SiteRequirements({ sites }: { sites: Site[] }) {
  const router = useRouter()
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "")
  const site = sites.find((s) => s.id === siteId)
  const [selected, setSelected] = useState<Set<string>>(new Set(site?.requiredTypes ?? []))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  function onSite(id: string) {
    setSiteId(id); setSaved(false)
    setSelected(new Set(sites.find((s) => s.id === id)?.requiredTypes ?? []))
  }
  function toggle(t: string) {
    setSaved(false)
    setSelected((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n })
  }
  async function save() {
    setBusy(true)
    await apiSend(`/api/sites/${siteId}/credential-requirements`, "PATCH", { types: [...selected] })
    setBusy(false); setSaved(true); router.refresh()
  }
  if (sites.length === 0) return <p className="text-sm text-slate-500">No sites yet.</p>
  return (
    <div className="space-y-3">
      <Field label="Site" htmlFor="r-site"><Select id="r-site" value={siteId} onChange={(e) => onSite(e.target.value)}>{sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</Select></Field>
      <div className="flex flex-wrap gap-2">
        {CREDENTIAL_TYPES.map((t) => (
          <label key={t} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm ${selected.has(t) ? "border-brand bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-600"}`}>
            <input type="checkbox" checked={selected.has(t)} onChange={() => toggle(t)} className="h-4 w-4" />
            {CREDENTIAL_TYPE_LABELS[t]}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save requirements"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
      </div>
    </div>
  )
}

export function ComplianceClient({ members, credentials, sites, alerts }: { members: Member[]; credentials: Cred[]; sites: Site[]; alerts: Cred[] }) {
  const router = useRouter()
  async function del(id: string) {
    await apiSend(`/api/credentials/${id}`, "DELETE")
    router.refresh()
  }
  return (
    <div className="space-y-8">
      {alerts.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Expiring &amp; expired credentials</h2>
          <Card className="divide-y divide-slate-100">
            {alerts.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span><span className="font-medium text-slate-800">{c.userName}</span> · {CREDENTIAL_TYPE_LABELS[c.type] ?? c.type} <span className="text-slate-500">expires {fmtD(c.expiryDate)}</span></span>
                <StatusBadge tone={STATE_TONE[c.state] ?? "neutral"}>{STATE_LABEL[c.state] ?? c.state}</StatusBadge>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Credentials</h2>
          <AddCredential members={members} />
        </div>
        {credentials.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">No credentials recorded yet.</Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Employee</th><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Issued</th><th className="px-4 py-2.5 font-medium">Expires</th><th className="px-4 py-2.5 font-medium">State</th><th className="px-4 py-2.5" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credentials.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.userName}</td>
                    <td className="px-4 py-3 text-slate-600">{CREDENTIAL_TYPE_LABELS[c.type] ?? c.type}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtD(c.issueDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtD(c.expiryDate)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={STATE_TONE[c.state] ?? "neutral"}>{STATE_LABEL[c.state] ?? c.state}</StatusBadge></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => del(c.id)} className="text-slate-400 hover:text-red-600" aria-label="Delete">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Site credential requirements</h2>
        <Card className="p-5"><SiteRequirements sites={sites} /></Card>
      </section>
    </div>
  )
}
