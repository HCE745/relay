"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { ACCESS_ITEM_TYPES } from "@/lib/zod-schemas"

type Site = { id: string; name: string }
type Member = { id: string; name: string }
type Item = { id: string; type: string; identifier: string; description: string | null; status: string; serviceLocation: { name: string } | null; holder: { id: string; name: string } | null; hasSecret: boolean }

const TYPE_LABEL: Record<string, string> = { KEY: "Key", FOB: "Fob", CODE: "Code", BADGE: "Badge", ALARM_CODE: "Alarm code" }
const STATUS_TONE: Record<string, BadgeTone> = { AVAILABLE: "neutral", ISSUED: "info", LOST: "danger", RETURNED: "success" }
const SECRET_TYPES = new Set(["CODE", "ALARM_CODE"])

function AddItem({ sites }: { sites: Site[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({ serviceLocationId: sites[0]?.id ?? "", type: "KEY", identifier: "", description: "", secret: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value })
  const isSecret = SECRET_TYPES.has(v.type)

  async function save() {
    setBusy(true); setError(null)
    const res = await apiSend("/api/access-items", "POST", {
      serviceLocationId: v.serviceLocationId, type: v.type, identifier: v.identifier,
      description: v.description || undefined, secret: isSecret && v.secret ? v.secret : undefined,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false); setV({ ...v, identifier: "", description: "", secret: "" }); router.refresh()
  }

  if (!open) return <Button onClick={() => setOpen(true)} disabled={sites.length === 0}>Add access item</Button>
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Site" htmlFor="x-site"><Select id="x-site" value={v.serviceLocationId} onChange={set("serviceLocationId")}>{sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</Select></Field>
        <Field label="Type" htmlFor="x-type"><Select id="x-type" value={v.type} onChange={set("type")}>{ACCESS_ITEM_TYPES.map((t) => (<option key={t} value={t}>{TYPE_LABEL[t]}</option>))}</Select></Field>
        <Field label="Label / identifier" htmlFor="x-id" hint="Non-secret, e.g. Front door #3"><Input id="x-id" value={v.identifier} onChange={set("identifier")} /></Field>
        <Field label="Description" htmlFor="x-desc"><Input id="x-desc" value={v.description} onChange={set("description")} /></Field>
        {isSecret ? (
          <Field label="Code (encrypted at rest)" htmlFor="x-secret" hint="Stored encrypted; never shown in lists"><Input id="x-secret" value={v.secret} onChange={set("secret")} /></Field>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button onClick={save} disabled={busy || !v.identifier || !v.serviceLocationId}>{busy ? "Saving…" : "Save"}</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  )
}

function ItemRow({ item, members }: { item: Item; members: Member[] }) {
  const router = useRouter()
  const [issueOpen, setIssueOpen] = useState(false)
  const [toUser, setToUser] = useState(members[0]?.id ?? "")
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(action: "issue" | "return" | "lost", userId?: string) {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/access-items/${item.id}`, "POST", { action, userId })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setIssueOpen(false); router.refresh()
  }
  async function reveal() {
    setBusy(true); setError(null); setRevealed(null)
    const res = await apiSend<{ secret: string }>(`/api/access-items/${item.id}/reveal`, "POST")
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setRevealed(res.data.secret)
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{item.identifier}</div>
        {item.description ? <div className="text-xs text-slate-500">{item.description}</div> : null}
        {revealed ? (
          <div className="mt-1 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1 font-mono text-sm text-amber-900">
            {revealed}
            <button onClick={() => setRevealed(null)} className="text-amber-500 hover:text-amber-700" aria-label="Hide">✕</button>
          </div>
        ) : null}
        {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
      </td>
      <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[item.type] ?? item.type}</td>
      <td className="px-4 py-3 text-slate-600">{item.serviceLocation?.name ?? "—"}</td>
      <td className="px-4 py-3"><StatusBadge tone={STATUS_TONE[item.status] ?? "neutral"}>{item.status}</StatusBadge></td>
      <td className="px-4 py-3 text-slate-600">{item.holder?.name ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {item.hasSecret ? <Button size="sm" variant="secondary" onClick={reveal} disabled={busy}>Reveal</Button> : null}
          {issueOpen ? (
            <>
              <Select value={toUser} onChange={(e) => setToUser(e.target.value)} className="w-36">{members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}</Select>
              <Button size="sm" onClick={() => act("issue", toUser)} disabled={busy || !toUser}>Confirm</Button>
              <Button size="sm" variant="ghost" onClick={() => setIssueOpen(false)}>Cancel</Button>
            </>
          ) : (
            <>
              {item.status !== "LOST" ? <Button size="sm" variant="secondary" onClick={() => setIssueOpen(true)}>Issue</Button> : null}
              {item.holder ? <Button size="sm" variant="secondary" onClick={() => act("return")} disabled={busy}>Return</Button> : null}
              {item.status !== "LOST" ? <Button size="sm" variant="danger" onClick={() => act("lost")} disabled={busy}>Lost</Button> : null}
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export function AccessClient({ sites, members, items }: { sites: Site[]; members: Member[]; items: Item[] }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><AddItem sites={sites} /></div>
      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">No access items yet. Add keys, fobs, badges or codes per site.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Item</th><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Site</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Holder</th><th className="px-4 py-2.5 text-right font-medium">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => <ItemRow key={i.id} item={i} members={members} />)}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
