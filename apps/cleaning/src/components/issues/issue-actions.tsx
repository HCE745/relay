"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Assignee = { id: string; name: string }
const NEXT: Record<string, string[]> = {
  OPEN: ["ACKNOWLEDGED", "RESOLVED", "CLOSED"],
  ACKNOWLEDGED: ["RESOLVED", "CLOSED", "OPEN"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: ["OPEN"],
}
const LABEL: Record<string, string> = {
  OPEN: "Reopen",
  ACKNOWLEDGED: "Acknowledge",
  RESOLVED: "Resolve",
  CLOSED: "Close",
}

export function IssueStatusBar({ issueId, status }: { issueId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function set(next: string) {
    setBusy(true)
    const res = await apiSend(`/api/issues/${issueId}/status`, "PATCH", { status: next })
    setBusy(false)
    if (res.ok) router.refresh()
    else alert(res.error)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {(NEXT[status] ?? []).map((s) => (
        <Button key={s} size="sm" variant={s === "CLOSED" ? "secondary" : "primary"} disabled={busy} onClick={() => set(s)}>
          {LABEL[s] ?? s}
        </Button>
      ))}
    </div>
  )
}

export function IssueAssignee({ issueId, current, users }: { issueId: string; current: string | null; users: Assignee[] }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [busy, setBusy] = useState(false)
  async function save(v: string) {
    setValue(v)
    setBusy(true)
    const res = await apiSend(`/api/issues/${issueId}/assign`, "PATCH", { assigneeId: v || null })
    setBusy(false)
    if (res.ok) router.refresh()
  }
  return (
    <Select value={value} disabled={busy} onChange={(e) => save(e.target.value)}>
      <option value="">Unassigned</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </Select>
  )
}

export function IssueCommentBox({ issueId }: { issueId: string }) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    const res = await apiSend(`/api/issues/${issueId}/comments`, "POST", { body })
    setBusy(false)
    if (res.ok) {
      setBody("")
      router.refresh()
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note…"
        className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <Button type="submit" size="sm" disabled={busy || !body.trim()}>
        {busy ? "Posting…" : "Add note"}
      </Button>
    </form>
  )
}
