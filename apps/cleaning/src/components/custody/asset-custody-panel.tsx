"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Select, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { CustodyHistory } from "@/components/custody/custody-history"

type Member = { id: string; name: string }
type JobOpt = { id: string; label: string }

export function AssetCustodyPanel({ assetId, holder, since, members, jobs }: { assetId: string; holder: { name: string } | null; since: string | null; members: Member[]; jobs: JobOpt[] }) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | "out" | "transfer">(null)
  const [toUser, setToUser] = useState(members[0]?.id ?? "")
  const [jobId, setJobId] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function custody(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError(null)
    const res = await apiSend("/api/custody", "POST", { kind: "ASSET", itemId: assetId, action, ...extra })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setPanel(null); setNotes(""); setJobId(""); router.refresh()
  }
  function reportLost() {
    if (!confirm("Report this asset lost? It will be removed from its holder.")) return
    const note = window.prompt("Notes (optional): what happened?") ?? undefined
    custody("REPORTED_LOST", { notes: note })
  }

  const out = Math.max(0, Date.now() - (since ? new Date(since).getTime() : Date.now()))
  const outLabel = since ? (out < 48 * 3_600_000 ? `${Math.max(1, Math.floor(out / 3_600_000))} hr` : `${Math.floor(out / 86_400_000)} days`) : null

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        {holder ? <>Currently held by <span className="font-medium">{holder.name}</span>{outLabel ? <span className="text-slate-400"> ({outLabel})</span> : null}</> : <span className="text-slate-500">Not checked out.</span>}
      </p>
      {panel === "out" ? (
        <div className="flex flex-wrap items-end gap-2">
          <Select value={toUser} onChange={(e) => setToUser(e.target.value)} className="w-48">{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
          <Select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-48"><option value="">No job (standing hold)</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}</Select>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-48" />
          <Button size="sm" onClick={() => custody("CHECKED_OUT", { toUserId: toUser, jobId: jobId || undefined, notes: notes || undefined })} disabled={busy || !toUser}>Check out</Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      ) : panel === "transfer" ? (
        <div className="flex flex-wrap items-end gap-2">
          <Select value={toUser} onChange={(e) => setToUser(e.target.value)} className="w-48">{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
          <Button size="sm" onClick={() => custody("TRANSFERRED", { toUserId: toUser })} disabled={busy || !toUser}>Transfer</Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {holder ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => custody("CHECKED_IN")} disabled={busy}>Check in</Button>
              <Button size="sm" variant="secondary" onClick={() => setPanel("transfer")}>Transfer</Button>
              <Button size="sm" variant="danger" onClick={reportLost} disabled={busy}>Report lost</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setPanel("out")} disabled={members.length === 0}>Check out</Button>
              <Button size="sm" variant="danger" onClick={reportLost} disabled={busy}>Report lost</Button>
            </>
          )}
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <CustodyHistory kind="ASSET" itemId={assetId} />
    </div>
  )
}
