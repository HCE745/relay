"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Req = { id: string; type: string; status: string; requestedDate: string | null; requestedTime: string | null; note: string | null; customer: string; jobTitle: string; siteName: string; scheduledStart: string }
const TONE: Record<string, BadgeTone> = { PENDING: "warning", APPROVED: "success", DECLINED: "neutral" }

export function ServiceRequestsClient({ requests }: { requests: Req[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function review(id: string, approve: boolean) {
    setBusy(id)
    await apiSend(`/api/service-requests/${id}/review`, "POST", { approve })
    setBusy(null); router.refresh()
  }
  const pending = requests.filter((r) => r.status === "PENDING")
  const past = requests.filter((r) => r.status !== "PENDING")

  const Row = ({ r }: { r: Req }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div className="min-w-0">
        <div className="font-medium text-slate-800">{r.customer}: {r.type === "CANCEL" ? "Cancel" : "Reschedule"}</div>
        <div className="text-slate-500">{r.jobTitle} · {r.siteName} · currently {new Date(r.scheduledStart).toLocaleString()}</div>
        {r.type === "RESCHEDULE" && r.requestedDate ? <div className="text-xs text-brand">Requested: {r.requestedDate} {r.requestedTime ?? ""}</div> : null}
        {r.note ? <div className="text-xs text-slate-400">“{r.note}”</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge>
        {r.status === "PENDING" ? (
          <>
            <Button size="sm" onClick={() => review(r.id, true)} disabled={busy === r.id}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => review(r.id, false)} disabled={busy === r.id}>Decline</Button>
          </>
        ) : null}
      </div>
    </li>
  )

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Pending requests</h2>
        {pending.length === 0 ? <p className="text-sm text-slate-500">No pending requests.</p> : <ul className="divide-y divide-slate-100">{pending.map((r) => <Row key={r.id} r={r} />)}</ul>}
      </Card>
      {past.length > 0 ? (
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Reviewed</h2>
          <ul className="divide-y divide-slate-100">{past.map((r) => <Row key={r.id} r={r} />)}</ul>
        </Card>
      ) : null}
    </div>
  )
}
