"use client"

import { useState } from "react"

// Kicks off Stripe Checkout for a public pay link (no login). Redirects to the
// hosted Stripe page; the webhook posts the payment back on success.
export function PayButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function pay() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/public/pay/${token}/checkout`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) { setBusy(false); return setError(data?.error ?? "Could not start checkout. Please try again.") }
      window.location.href = data.url as string
    } catch {
      setBusy(false); setError("Could not reach the payment page. Please try again.")
    }
  }
  return (
    <div>
      <button onClick={pay} disabled={busy} className="w-full rounded-xl bg-brand-700 py-3 text-base font-semibold text-white disabled:opacity-60">
        {busy ? "Starting checkout…" : "Pay now"}
      </button>
      {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </div>
  )
}
