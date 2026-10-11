"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Input, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type ChangeOrder = { id: string; description: string; amount: string; status: string; requiresCustomerApproval: boolean; approvedByPortal: boolean }
const TONE: Record<string, BadgeTone> = { PENDING: "warning", APPROVED: "success", DECLINED: "neutral" }

// Billable extras / change orders on a job (Phase 20). Managers add extras and
// record a decision; approved extras flow onto the next invoice as distinct lines.
export function ChangeOrdersPanel({ jobId, changeOrders }: { jobId: string; changeOrders: ChangeOrder[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [v, setV] = useState({ description: "", amount: "", requiresCustomerApproval: true })

  async function add() {
    setBusy(true); setError(null)
    const res = await apiSend("/api/change-orders", "POST", { jobId, description: v.description, amount: v.amount, requiresCustomerApproval: v.requiresCustomerApproval })
    setBusy(false); if (!res.ok) return setError(res.error)
    setV({ description: "", amount: "", requiresCustomerApproval: true }); setAdding(false); router.refresh()
  }
  async function decide(id: string, decision: "APPROVED" | "DECLINED") {
    setBusy(true); await apiSend(`/api/change-orders/${id}/decision`, "POST", { decision }); setBusy(false); router.refresh()
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Billable extras</h2>
          <p className="text-xs text-slate-400">Approved extras appear as distinct lines on the next invoice.</p>
        </div>
        <Button size="sm" variant={adding ? "ghost" : "secondary"} onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Add extra"}</Button>
      </div>

      {adding ? (
        <div className="mb-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <Input placeholder="What's the extra? (e.g. pressure-wash the entry)" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          <div className="flex items-center gap-3">
            <Input placeholder="Amount $" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} inputMode="decimal" className="w-32" />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={v.requiresCustomerApproval} onChange={(e) => setV({ ...v, requiresCustomerApproval: e.target.checked })} />
              Needs customer approval
            </label>
            <Button size="sm" onClick={add} disabled={busy || !v.description || !v.amount}>Save</Button>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {changeOrders.length === 0 ? (
        <p className="text-sm text-slate-500">No extras on this job.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {changeOrders.map((co) => (
            <li key={co.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-slate-800">{co.description}</div>
                <div className="text-xs text-slate-400">${co.amount}{co.requiresCustomerApproval ? " · customer approval" : " · internal"}{co.approvedByPortal ? " · approved in portal" : ""}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone={TONE[co.status] ?? "neutral"}>{co.status}</StatusBadge>
                {co.status === "PENDING" ? (
                  <>
                    <Button size="sm" onClick={() => decide(co.id, "APPROVED")} disabled={busy}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(co.id, "DECLINED")} disabled={busy}>Decline</Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
