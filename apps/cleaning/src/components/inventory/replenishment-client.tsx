"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Req = { id: string; status: string; supply: string | null; unit: string | null; location: string | null; quantity: string | null; note: string | null; requestedBy: string; reviewedBy: string | null; createdAt: string }
const TONE: Record<string, BadgeTone> = { OPEN: "warning", APPROVED: "info", FULFILLED: "success", DECLINED: "neutral", CLOSED: "neutral" }

export function ReplenishmentClient({ requests }: { requests: Req[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function review(id: string, status: string) {
    setBusy(id)
    await apiSend(`/api/replenishment/${id}`, "PATCH", { status })
    setBusy(null); router.refresh()
  }
  const open = requests.filter((r) => r.status === "OPEN" || r.status === "APPROVED")
  const past = requests.filter((r) => r.status !== "OPEN" && r.status !== "APPROVED")

  const Row = ({ r }: { r: Req }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div className="min-w-0">
        <div className="font-medium text-slate-800">{r.supply ?? "General request"}{r.quantity ? ` · ${r.quantity}${r.unit ? ` ${r.unit}` : ""}` : ""}</div>
        <div className="text-xs text-slate-500">{[r.location, `by ${r.requestedBy}`, new Date(r.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}</div>
        {r.note ? <div className="text-xs text-slate-400">“{r.note}”</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge>
        {r.status === "OPEN" ? (<>
          <Button size="sm" onClick={() => review(r.id, "APPROVED")} disabled={busy === r.id}>Approve</Button>
          <Button size="sm" variant="ghost" onClick={() => review(r.id, "DECLINED")} disabled={busy === r.id}>Decline</Button>
        </>) : null}
        {r.status === "APPROVED" ? <Button size="sm" onClick={() => review(r.id, "FULFILLED")} disabled={busy === r.id}>Mark fulfilled</Button> : null}
      </div>
    </li>
  )

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Open ({open.length})</h2>
        {open.length === 0 ? <p className="text-sm text-slate-500">No open requests.</p> : <ul className="divide-y divide-slate-100">{open.map((r) => <Row key={r.id} r={r} />)}</ul>}
      </Card>
      {past.length > 0 ? (
        <Card className="p-5"><h2 className="mb-2 text-sm font-semibold text-slate-700">Resolved</h2><ul className="divide-y divide-slate-100">{past.map((r) => <Row key={r.id} r={r} />)}</ul></Card>
      ) : null}
    </div>
  )
}
