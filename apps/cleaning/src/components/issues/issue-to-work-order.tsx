"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { WORK_ORDER_TYPES } from "@/lib/zod-schemas"

const TYPE_LABEL: Record<string, string> = { EMERGENCY: "Emergency", ONE_TIME: "One-time", ADDITIONAL: "Additional", DEEP_CLEAN: "Deep clean" }

// Turn a complaint into billable remediation (Phase 20). One work order per issue.
export function IssueToWorkOrderButton({ issueId }: { issueId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [v, setV] = useState({ type: "ADDITIONAL", quotedAmount: "" })

  async function create() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/issues/${issueId}/work-order`, "POST", { type: v.type, quotedAmount: v.quotedAmount || undefined })
    setBusy(false); if (!res.ok) return setError(res.error)
    setOpen(false); router.push("/work-orders")
  }
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Make work order</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Billable work order from this issue">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Create a billable work order to remediate this problem. It can then be quoted, scheduled and invoiced.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="iwo-type"><Select id="iwo-type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>{WORK_ORDER_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select></Field>
            <Field label="Quote ($, optional)" htmlFor="iwo-amt"><Input id="iwo-amt" value={v.quotedAmount} onChange={(e) => setV({ ...v, quotedAmount: e.target.value })} inputMode="decimal" /></Field>
          </div>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} disabled={busy}>Create work order</Button></div>
        </div>
      </Modal>
    </>
  )
}
