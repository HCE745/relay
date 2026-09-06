"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Select, EmptyState } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Assignee = { userId: string; name: string }
type Cleaner = { id: string; name: string }
type Conflict = { title: string }

export function AssignmentsPanel({
  jobId,
  assignments,
  cleaners,
  canManage,
}: {
  jobId: string
  assignments: Assignee[]
  cleaners: Cleaner[]
  canManage: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const assignedIds = new Set(assignments.map((a) => a.userId))
  const available = cleaners.filter((c) => !assignedIds.has(c.id))

  async function assign() {
    if (!selected) return
    setBusy(true)
    setError(null)
    setWarning(null)
    const res = await apiSend<{ conflicts: Conflict[] }>(`/api/jobs/${jobId}/assignments`, "POST", { userId: selected })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    if (res.data.conflicts?.length) {
      setWarning(`Heads up: this cleaner already has ${res.data.conflicts.length} overlapping job(s): ${res.data.conflicts.map((c) => c.title).join(", ")}`)
    }
    setSelected("")
    router.refresh()
  }

  async function remove(userId: string) {
    setBusy(true)
    setError(null)
    const res = await apiSend(`/api/jobs/${jobId}/assignments/${userId}`, "DELETE")
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Assigned cleaners</h2>

      {assignments.length === 0 ? (
        <EmptyState title="No cleaners assigned" />
      ) : (
        <ul className="mb-3 divide-y divide-slate-100">
          {assignments.map((a) => (
            <li key={a.userId} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-800">{a.name}</span>
              {canManage ? (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(a.userId)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="flex items-center gap-2">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1">
            <option value="">{available.length ? "Assign a cleaner…" : "No available cleaners"}</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button disabled={busy || !selected} onClick={assign}>
            Assign
          </Button>
        </div>
      ) : null}

      {warning ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning}</p> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </Card>
  )
}
