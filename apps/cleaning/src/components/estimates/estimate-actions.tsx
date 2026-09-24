"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Status transitions + the estimate→customer conversion. A failed conversion
// (e.g. pricing can't map cleanly) surfaces the server message + unmet reasons;
// the DB transaction guarantees no partial customer/site/plan is created.
export function EstimateActions({ estimateId, status }: { estimateId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unmet, setUnmet] = useState<string[] | null>(null)
  const [convertedId, setConvertedId] = useState<string | null>(null)

  async function setStatus(next: string) {
    setBusy(true)
    setError(null)
    setUnmet(null)
    const res = await apiSend(`/api/estimates/${estimateId}/status`, "POST", { status: next })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  async function convert() {
    if (!window.confirm("Convert this estimate into a live customer, site and service plan?")) return
    setBusy(true)
    setError(null)
    setUnmet(null)
    const res = await apiSend<{ customerId: string }>(`/api/estimates/${estimateId}/convert`, "POST", {})
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      setUnmet(res.unmet ?? null)
      return
    }
    setConvertedId(res.data.customerId)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "DRAFT" ? (
          <Button size="sm" disabled={busy} onClick={() => setStatus("SENT")}>Mark sent</Button>
        ) : null}
        {status === "SENT" ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => setStatus("ACCEPTED")}>Mark accepted</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus("DECLINED")}>Declined</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus("EXPIRED")}>Expired</Button>
          </>
        ) : null}
        {status === "ACCEPTED" ? (
          <Button size="sm" disabled={busy} onClick={convert}>{busy ? "Converting…" : "Convert to customer"}</Button>
        ) : null}
        {convertedId ? (
          <Link
            href={`/customers/${convertedId}`}
            className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Open customer →
          </Link>
        ) : null}
      </div>
      {error ? (
        <div className="max-w-sm rounded-lg bg-red-50 px-3 py-2 text-right text-sm text-red-700">
          {error}
          {unmet && unmet.length > 0 ? (
            <ul className="mt-1 list-disc pl-4 text-left text-xs">
              {unmet.map((u, i) => (<li key={i}>{u}</li>))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
