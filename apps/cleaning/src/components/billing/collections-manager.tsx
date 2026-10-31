"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { COLLECTION_CHANNELS } from "@/lib/zod-schemas"

export type StepRow = {
  id: string; dayOffset: number; channel: "EMAIL" | "SMS"; subject: string | null; body: string; isActive: boolean
}

const blank = { dayOffset: "7", channel: "EMAIL" as "EMAIL" | "SMS", subject: "", body: "" }

export function CollectionsManager({ steps }: { steps: StepRow[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ ...blank })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof blank, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null) }

  function startEdit(s: StepRow) {
    setEditingId(s.id)
    setForm({ dayOffset: String(s.dayOffset), channel: s.channel, subject: s.subject ?? "", body: s.body })
    setError(null)
  }
  function cancel() { setEditingId(null); setForm({ ...blank }); setError(null) }

  async function submit() {
    if (!form.body.trim()) return setError("Enter a message")
    setBusy(true); setError(null)
    const payload = { dayOffset: Number(form.dayOffset), channel: form.channel, subject: form.subject || undefined, body: form.body }
    const res = editingId ? await apiSend(`/api/collections/steps/${editingId}`, "PATCH", payload) : await apiSend("/api/collections/steps", "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    cancel(); router.refresh()
  }
  async function deactivate(id: string) {
    if (!confirm("Remove this step from the sequence?")) return
    const res = await apiSend(`/api/collections/steps/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    if (editingId === id) cancel()
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        Steps fire in order of days past the invoice due date. The sequence stops automatically when an invoice is
        paid. Opt a customer out on their page, or hold a single invoice from its page. Templates accept{" "}
        <code className="rounded bg-slate-200/70 px-1">{"{customerName}"}</code>{" "}
        <code className="rounded bg-slate-200/70 px-1">{"{invoiceNumber}"}</code>{" "}
        <code className="rounded bg-slate-200/70 px-1">{"{balance}"}</code>{" "}
        <code className="rounded bg-slate-200/70 px-1">{"{daysOverdue}"}</code>{" "}
        <code className="rounded bg-slate-200/70 px-1">{"{dueDate}"}</code>.
      </Card>

      <Card className="overflow-x-auto">
        {steps.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No steps yet. Until you add some, a single reminder is sent once an invoice is overdue.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Channel</th><th className="px-4 py-2.5 font-medium">Message</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {steps.map((s) => (
                <tr key={s.id} className={s.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{s.dayOffset === 0 ? "On due date" : `+${s.dayOffset} day${s.dayOffset === 1 ? "" : "s"}`}</td>
                  <td className="px-4 py-3 text-slate-600">{s.channel}</td>
                  <td className="px-4 py-3 text-slate-600"><div className="line-clamp-2 max-w-md">{s.subject ? <span className="font-medium">{s.subject}: </span> : null}{s.body}</div></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(s)} className="mr-3 text-sm font-medium text-brand hover:underline">Edit</button>
                    {s.isActive ? <button onClick={() => deactivate(s.id)} className="text-sm font-medium text-red-600 hover:underline">Remove</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{editingId ? "Edit step" : "Add a step"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Days past due" htmlFor="cs-day"><Input id="cs-day" type="number" min={0} max={365} value={form.dayOffset} onChange={(e) => set("dayOffset", e.target.value)} /></Field>
          <Field label="Channel" htmlFor="cs-chan"><Select id="cs-chan" value={form.channel} onChange={(e) => set("channel", e.target.value)}>{COLLECTION_CHANNELS.map((c) => <option key={c} value={c}>{c === "EMAIL" ? "Email" : "SMS"}</option>)}</Select></Field>
          <Field label="Subject (email)" htmlFor="cs-subj"><Input id="cs-subj" value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Invoice {invoiceNumber} past due" /></Field>
        </div>
        <div className="mt-3">
          <Field label="Message" htmlFor="cs-body"><Textarea id="cs-body" value={form.body} onChange={(e) => set("body", e.target.value)} placeholder="Hi {customerName}, invoice {invoiceNumber} for {balance} is now {daysOverdue} days past due…" /></Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : editingId ? "Save step" : "Add step"}</Button>
          {editingId ? <Button variant="secondary" onClick={cancel}>Cancel</Button> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>
    </div>
  )
}
