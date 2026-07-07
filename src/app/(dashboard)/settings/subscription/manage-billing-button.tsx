"use client"

import { useState } from "react"
import { CreditCard, Loader2 } from "lucide-react"

export function ManageBillingButton({ hasStripeCustomer }: { hasStripeCustomer: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  if (!hasStripeCustomer) {
    return (
      <button
        disabled
        title="Complete checkout to access billing portal"
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-400 font-semibold rounded-xl text-sm cursor-not-allowed"
      >
        <CreditCard className="w-4 h-4" />
        Manage Billing
      </button>
    )
  }

  async function handleClick() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/subscription/billing-portal", { method: "POST" })
      const j = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok || !j.url) {
        setError(j.error ?? "Failed to open billing portal. Please try again.")
        return
      }
      window.location.href = j.url
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-blue-400 text-gray-700 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        Manage Billing
      </button>
      {error && <p className="text-xs text-red-600 mt-1 text-center">{error}</p>}
    </div>
  )
}
