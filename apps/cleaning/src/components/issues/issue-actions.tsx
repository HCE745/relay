"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Assignee = { id: string; name: string }
// CLOSED is reached only by VERIFICATION (a different person), via a separate
// endpoint — so it's never offered from OPEN/ACKNOWLEDGED (Phase 30).
const NEXT: Record<string, string[]> = {
  OPEN: ["ACKNOWLEDGED", "RESOLVED"],
  ACKNOWLEDGED: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: ["OPEN"],
}
const LABEL: Record<string, string> = {
  OPEN: "Reopen",
  ACKNOWLEDGED: "Acknowledge",
  RESOLVED: "Resolve",
  CLOSED: "Verify & close",
}

export function IssueStatusBar({ issueId, status }: { issueId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function set(next: string) {
    setBusy(true)
    // Closing goes through verification (resolver ≠ verifier, enforced server-side).
    const res = next === "CLOSED"
      ? await apiSend(`/api/issues/${issueId}/verify`, "POST")
      : await apiSend(`/api/issues/${issueId}/status`, "PATCH", { status: next })
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
    // Reassigning an already-owned issue records a reason (tracked in the audit log).
    let reason: string | undefined
    if (current && v !== current) {
      reason = window.prompt("Reason for reassigning this issue?") ?? undefined
    }
    setValue(v)
    setBusy(true)
    const res = await apiSend(`/api/issues/${issueId}/assign`, "PATCH", { assigneeId: v || null, reason })
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

type AssetOption = { id: string; name: string }
export function IssueAssetLink({ issueId, current, assets }: { issueId: string; current: string | null; assets: AssetOption[] }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [busy, setBusy] = useState(false)
  async function save(v: string) {
    setValue(v)
    setBusy(true)
    const res = await apiSend(`/api/issues/${issueId}/asset`, "PATCH", { assetId: v })
    setBusy(false)
    if (res.ok) router.refresh()
  }
  return (
    <Select value={value} disabled={busy} onChange={(e) => save(e.target.value)}>
      <option value="">No asset</option>
      {assets.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
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
