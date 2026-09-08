"use client"

import { useState } from "react"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDone(false)
    const res = await apiSend("/api/account/password", "PATCH", { currentPassword: current, newPassword: next })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(true)
    setCurrent("")
    setNext("")
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <Field label="Current password" htmlFor="cp-cur">
        <Input id="cp-cur" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" htmlFor="cp-new" hint="At least 8 characters">
        <Input id="cp-new" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      {done ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password changed.</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </Button>
    </form>
  )
}
