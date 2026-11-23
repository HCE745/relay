"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Archive / restore a customer. Archiving is preferred over deletion — the record
// (and any linked service-exclusion incident history) is always preserved. When
// the customer has exclusion history we show a prominent warning and explain
// that the documented incident and its customer association are kept.
export function CustomerArchiveButton({
  customerId,
  isArchived,
  exclusionCount,
}: {
  customerId: string
  isArchived: boolean
  exclusionCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function archive() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/customers/${customerId}`, "DELETE", { reason: reason || undefined })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false); router.refresh()
  }
  async function restore() {
    setBusy(true)
    await apiSend(`/api/customers/${customerId}`, "DELETE", { restore: true })
    setBusy(false); router.refresh()
  }

  if (isArchived) {
    return <Button variant="secondary" onClick={restore} disabled={busy}>{busy ? "Restoring…" : "Restore"}</Button>
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Archive</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Archive this customer?">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Archiving removes this customer from active lists but <span className="font-medium">keeps the record</span>.
            Customers are never permanently deleted, so their history is preserved.
          </p>
          {exclusionCount > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">This account is linked to {exclusionCount} documented service {exclusionCount === 1 ? "exclusion" : "exclusions"}.</p>
              <p className="mt-1">
                The incident record and its link to this customer are preserved on archive — nothing is lost. Permanent
                deletion is not permitted for accounts with exclusion history.
              </p>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Reason (optional)</label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this account being archived?" />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={archive} disabled={busy}>{busy ? "Archiving…" : "Archive customer"}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
