"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Input, StatusBadge } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type TaskRow = {
  id: string
  label: string
  requiresDocument: boolean
  status: string
  documentRef: string | null
  note: string | null
  completedAt: Date | string | null
}

export function OnboardingTasks({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter()
  const [docRefs, setDocRefs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function complete(t: TaskRow) {
    if (t.requiresDocument && !(docRefs[t.id] ?? "").trim()) return setError("This item needs a document reference")
    setBusy(t.id)
    setError(null)
    const res = await apiSend(`/api/onboarding/tasks/${t.id}`, "PATCH", { documentRef: docRefs[t.id] ?? null })
    setBusy(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function reopen(id: string) {
    setBusy(id)
    const res = await apiSend(`/api/onboarding/tasks/${id}`, "DELETE")
    setBusy(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <Card className="divide-y divide-slate-100">
      {error ? <p className="p-3 text-sm text-red-600">{error}</p> : null}
      {tasks.map((t) => {
        const done = t.status === "COMPLETE"
        return (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.label}</span>
                {t.requiresDocument ? <StatusBadge tone="info">doc</StatusBadge> : null}
                {done ? <StatusBadge tone="success">Done</StatusBadge> : null}
              </div>
              {done && t.documentRef ? <div className="text-xs text-slate-400">Ref: {t.documentRef}</div> : null}
            </div>
            <div className="flex items-center gap-2">
              {!done && t.requiresDocument ? (
                <Input
                  value={docRefs[t.id] ?? ""}
                  onChange={(e) => setDocRefs((m) => ({ ...m, [t.id]: e.target.value }))}
                  placeholder="document link / ref"
                  className="w-48"
                />
              ) : null}
              {done ? (
                <Button size="sm" variant="secondary" onClick={() => reopen(t.id)} disabled={busy === t.id}>
                  Reopen
                </Button>
              ) : (
                <Button size="sm" onClick={() => complete(t)} disabled={busy === t.id}>
                  {busy === t.id ? "Saving…" : "Mark done"}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </Card>
  )
}
