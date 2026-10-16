"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { ACCESS_ITEM_TYPES } from "@/lib/zod-schemas"
import { CustodyHistory } from "@/components/custody/custody-history"

type Site = { id: string; name: string }
type Member = { id: string; name: string }
type JobOpt = { id: string; label: string }
type Item = { id: string; type: string; identifier: string; description: string | null; status: string; serviceLocation: { name: string } | null; holder: { id: string; name: string } | null; heldSince: string | Date | null; replaces: { id: string; identifier: string } | null; hasSecret: boolean }

// Compact "how long held" from a checkout timestamp.
function heldFor(since: string | Date | null): string | null {
  if (!since) return null
  const ms = Date.now() - new Date(since).getTime()
  if (ms < 0) return null
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`
  if (h < 48) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

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

function ItemRow({ item, members, jobs }: { item: Item; members: Member[]; jobs: JobOpt[] }) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | "out" | "transfer">(null)
  const [toUser, setToUser] = useState(members[0]?.id ?? "")
  const [jobId, setJobId] = useState("")
  const [notes, setNotes] = useState("")
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function custody(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError(null)
    const res = await apiSend("/api/custody", "POST", { kind: "ACCESS", itemId: item.id, action, ...extra })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setPanel(null); setNotes(""); setJobId(""); router.refresh()
  }
  async function reveal() {
    setBusy(true); setError(null); setRevealed(null)
    const res = await apiSend<{ secret: string }>(`/api/access-items/${item.id}/reveal`, "POST")
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setRevealed(res.data.secret)
  }
  function reportLost() {
    if (!confirm("Report this item lost? It will be removed from its holder and marked lost.")) return
    const note = window.prompt("Notes (optional): what happened?") ?? undefined
    custody("REPORTED_LOST", { notes: note })
  }
  function replace() {
    const identifier = window.prompt("Identifier for the replacement item (e.g. Front door key #4):")
    if (!identifier || !identifier.trim()) return
    custody("REPLACED", { identifier: identifier.trim() })
  }

  const held = heldFor(item.heldSince)
  return (
    <tr className="hover:bg-slate-50 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{item.identifier}</div>
        {item.description ? <div className="text-xs text-slate-500">{item.description}</div> : null}
        {item.replaces ? <div className="text-xs text-slate-400">Replaces {item.replaces.identifier}</div> : null}
        {revealed ? (
          <div className="mt-1 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1 font-mono text-sm text-amber-900">
            {revealed}
            <button onClick={() => setRevealed(null)} className="text-amber-500 hover:text-amber-700" aria-label="Hide">✕</button>
          </div>
        ) : null}
        <div className="mt-1"><CustodyHistory kind="ACCESS" itemId={item.id} /></div>
        {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
      </td>
      <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[item.type] ?? item.type}</td>
      <td className="px-4 py-3 text-slate-600">{item.serviceLocation?.name ?? "-"}</td>
      <td className="px-4 py-3"><StatusBadge tone={STATUS_TONE[item.status] ?? "neutral"}>{item.status}</StatusBadge></td>
      <td className="px-4 py-3 text-slate-600">{item.holder?.name ?? "-"}{held ? <span className="ml-1 text-xs text-slate-400">({held})</span> : null}</td>
      <td className="px-4 py-3">
        {panel === "out" ? (
          <div className="flex flex-col items-end gap-1.5">
            <Select value={toUser} onChange={(e) => setToUser(e.target.value)} className="w-44">{members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}</Select>
            <Select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-44"><option value="">No job (standing hold)</option>{jobs.map((j) => (<option key={j.id} value={j.id}>{j.label}</option>))}</Select>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-44" />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => custody("CHECKED_OUT", { toUserId: toUser, jobId: jobId || undefined, notes: notes || undefined })} disabled={busy || !toUser}>Check out</Button>
              <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
            </div>
          </div>
        ) : panel === "transfer" ? (
          <div className="flex flex-col items-end gap-1.5">
            <Select value={toUser} onChange={(e) => setToUser(e.target.value)} className="w-44">{members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}</Select>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => custody("TRANSFERRED", { toUserId: toUser })} disabled={busy || !toUser}>Transfer</Button>
              <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {item.hasSecret ? <Button size="sm" variant="secondary" onClick={reveal} disabled={busy}>Reveal</Button> : null}
            {item.status === "LOST" ? (
              <Button size="sm" onClick={replace} disabled={busy}>Replace</Button>
            ) : item.holder ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => custody("CHECKED_IN")} disabled={busy}>Check in</Button>
                <Button size="sm" variant="secondary" onClick={() => setPanel("transfer")}>Transfer</Button>
                <Button size="sm" variant="danger" onClick={reportLost} disabled={busy}>Lost</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => setPanel("out")}>Check out</Button>
                <Button size="sm" variant="danger" onClick={reportLost} disabled={busy}>Lost</Button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export function AccessClient({ sites, members, items, jobs }: { sites: Site[]; members: Member[]; items: Item[]; jobs: JobOpt[] }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <a href="/access/outstanding" className="text-sm font-medium text-brand hover:underline">Outstanding items report →</a>
        <AddItem sites={sites} />
      </div>
      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">No access items yet. Add keys, fobs, badges or codes per site.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Item</th><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Site</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Holder</th><th className="px-4 py-2.5 text-right font-medium">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => <ItemRow key={i.id} item={i} members={members} jobs={jobs} />)}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
