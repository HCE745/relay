"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, Select, Textarea, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { WORK_ORDER_TYPES, WORK_ORDER_PRIORITIES } from "@/lib/zod-schemas"

type Customer = { id: string; name: string; sites: { id: string; name: string }[] }
type WorkOrder = {
  id: string; type: string; description: string; priority: string; status: string
  quotedAmount: string | null; customerName: string; siteName: string | null; convertedJobId: string | null; requestedBy: string | null
}

const TYPE_LABEL: Record<string, string> = { EMERGENCY: "Emergency", ONE_TIME: "One-time", ADDITIONAL: "Additional", DEEP_CLEAN: "Deep clean" }
const S_TONE: Record<string, BadgeTone> = { REQUESTED: "info", QUOTED: "purple", APPROVED: "brand", SCHEDULED: "warning", COMPLETED: "success", DECLINED: "neutral" }
const P_TONE: Record<string, BadgeTone> = { LOW: "neutral", NORMAL: "info", HIGH: "warning", URGENT: "danger" }

export function NewWorkOrderButton({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [v, setV] = useState({ customerId: customers[0]?.id ?? "", serviceLocationId: "", type: "ONE_TIME", priority: "NORMAL", quotedAmount: "", requestedBy: "", description: "" })
  const sites = customers.find((c) => c.id === v.customerId)?.sites ?? []
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })

  async function save() {
    setBusy(true); setError(null)
    const res = await apiSend("/api/work-orders", "POST", {
      customerId: v.customerId, serviceLocationId: v.serviceLocationId || undefined, type: v.type,
      priority: v.priority, quotedAmount: v.quotedAmount || undefined, requestedBy: v.requestedBy || undefined, description: v.description,
    })
    setBusy(false); if (!res.ok) return setError(res.error)
    setOpen(false); setV({ ...v, description: "", quotedAmount: "", requestedBy: "" }); router.refresh()
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={customers.length === 0}>New work order</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New work order">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer" htmlFor="wo-cust"><Select id="wo-cust" value={v.customerId} onChange={(e) => setV({ ...v, customerId: e.target.value, serviceLocationId: "" })}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Site (optional)" htmlFor="wo-site"><Select id="wo-site" value={v.serviceLocationId} onChange={set("serviceLocationId")}><option value="">—</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type" htmlFor="wo-type"><Select id="wo-type" value={v.type} onChange={set("type")}>{WORK_ORDER_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select></Field>
            <Field label="Priority" htmlFor="wo-pri"><Select id="wo-pri" value={v.priority} onChange={set("priority")}>{WORK_ORDER_PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</Select></Field>
            <Field label="Quote ($)" htmlFor="wo-amt"><Input id="wo-amt" value={v.quotedAmount} onChange={set("quotedAmount")} inputMode="decimal" placeholder="450.00" /></Field>
          </div>
          <Field label="Requested by (optional)" htmlFor="wo-req"><Input id="wo-req" value={v.requestedBy} onChange={set("requestedBy")} placeholder="Site manager who called" /></Field>
          <Field label="What's the work?" htmlFor="wo-desc"><Textarea id="wo-desc" value={v.description} onChange={set("description")} placeholder="Strip & wax the lobby after the weekend event…" /></Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={busy || !v.customerId || !v.description}>Create</Button></div>
        </div>
      </Modal>
    </>
  )
}

function WorkOrderCard({ wo }: { wo: WorkOrder }) {
  const router = useRouter()
  const [mode, setMode] = useState<"none" | "convert">("none")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cv, setCv] = useState({ date: new Date().toISOString().slice(0, 10), startTime: "09:00", rate: wo.quotedAmount ?? "" })
  const terminal = !!wo.convertedJobId || wo.status === "DECLINED" || wo.status === "COMPLETED"

  async function setStatus(status: string) { setBusy(true); await apiSend(`/api/work-orders/${wo.id}`, "PATCH", { status }); setBusy(false); router.refresh() }
  async function convert() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/work-orders/${wo.id}/convert`, "POST", { date: cv.date, startTime: cv.startTime, rate: cv.rate || undefined })
    setBusy(false); if (!res.ok) return setError(res.error)
    setMode("none"); router.refresh()
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{wo.customerName}{wo.siteName ? ` · ${wo.siteName}` : ""}</div>
          <div className="mt-0.5 line-clamp-2 text-sm text-slate-600">{wo.description}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge tone={S_TONE[wo.status] ?? "neutral"}>{wo.status}</StatusBadge>
          <StatusBadge tone={P_TONE[wo.priority] ?? "neutral"}>{TYPE_LABEL[wo.type]} · {wo.priority}</StatusBadge>
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-500">{wo.quotedAmount ? `Quoted $${wo.quotedAmount}` : "Not yet quoted"}{wo.requestedBy ? ` · by ${wo.requestedBy}` : ""}</div>
      {wo.convertedJobId ? (
        <div className="mt-2"><Link href={`/jobs/${wo.convertedJobId}`} className="text-sm font-medium text-brand hover:underline">Scheduled job →</Link></div>
      ) : !terminal ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode(mode === "convert" ? "none" : "convert")}>Schedule &amp; bill</Button>
          {wo.status === "REQUESTED" ? <Button size="sm" variant="secondary" onClick={() => setStatus("QUOTED")} disabled={busy}>Mark quoted</Button> : null}
          <Button size="sm" variant="ghost" onClick={() => setStatus("DECLINED")} disabled={busy}>Decline</Button>
        </div>
      ) : null}
      {mode === "convert" ? (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2.5">
          <div className="grid grid-cols-3 gap-2">
            <Input type="date" value={cv.date} onChange={(e) => setCv({ ...cv, date: e.target.value })} />
            <Input type="time" value={cv.startTime} onChange={(e) => setCv({ ...cv, startTime: e.target.value })} />
            <Input placeholder="Rate $" value={cv.rate} onChange={(e) => setCv({ ...cv, rate: e.target.value })} inputMode="decimal" />
          </div>
          <p className="text-xs text-slate-400">Creates a scheduled, billable job. Needs a site and a rate (defaults to the quote).</p>
          <Button size="sm" onClick={convert} disabled={busy}>Create job</Button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </Card>
  )
}

export function WorkOrdersClient({ workOrders }: { workOrders: WorkOrder[] }) {
  const open = workOrders.filter((w) => !w.convertedJobId && w.status !== "DECLINED" && w.status !== "COMPLETED")
  const done = workOrders.filter((w) => w.convertedJobId || w.status === "DECLINED" || w.status === "COMPLETED")
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Open requests</h2>
        {open.length === 0 ? <Card className="p-5 text-center text-sm text-slate-500">No open work orders.</Card> : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{open.map((w) => <WorkOrderCard key={w.id} wo={w} />)}</div>
        )}
      </section>
      {done.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Scheduled / closed</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{done.map((w) => <WorkOrderCard key={w.id} wo={w} />)}</div>
        </section>
      ) : null}
    </div>
  )
}
