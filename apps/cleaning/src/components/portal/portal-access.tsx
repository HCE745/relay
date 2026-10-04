"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, StatusBadge } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type User = { id: string; name: string; email: string; isActive: boolean }
type Invite = { id: string; email: string; status: string; expiresAt: string }

export function PortalAccess({ customerId, users, invites }: { customerId: string; users: User[]; invites: Invite[] }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  async function invite() {
    setBusy(true); setError(null); setLink(null)
    const res = await apiSend<{ emailed: boolean; link: string | null }>("/api/portal/invites", "POST", { customerId, email })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setEmail("")
    if (res.data.link) setLink(res.data.link) // email unconfigured → show copyable link
    router.refresh()
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Portal access</h2>
      <p className="mb-3 text-sm text-slate-500">Invite this customer&apos;s contacts to view their service, inspections, issues and invoices.</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Invite by email" htmlFor="pa-email"><Input id="pa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" /></Field>
        <Button onClick={invite} disabled={busy || !email}>{busy ? "Inviting…" : "Send invite"}</Button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {link ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Email isn&apos;t configured — share this activation link with the contact:
          <div className="mt-1 break-all font-mono text-xs text-amber-900">{link}</div>
        </div>
      ) : null}

      {(users.length > 0 || invites.length > 0) ? (
        <div className="mt-4 space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span><span className="font-medium text-slate-800">{u.name}</span> <span className="text-slate-500">{u.email}</span></span>
              <StatusBadge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Invited"}</StatusBadge>
            </div>
          ))}
          {invites.filter((i) => i.status === "PENDING").map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
              <span>{i.email}</span>
              <StatusBadge tone="warning">Invite pending</StatusBadge>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
