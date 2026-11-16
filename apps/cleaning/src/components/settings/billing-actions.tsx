"use client"

import { useState } from "react"
import { Card } from "@/components/ui/controls"

type PlanView = { tier: string; name: string; includedSeats: number; monthly: number; annual: number }

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// Billing actions (Phase E). Starts a Stripe Checkout for the chosen plan/interval
// or opens the Billing Portal, via the authenticated /api/billing/* routes. These
// do nothing until billing env is configured — the page only renders this when
// isBillingConfigured() is true.
export function BillingActions({
  plans,
  hasStripeCustomer,
  currentTier,
}: {
  plans: PlanView[]
  hasStripeCustomer: boolean
  currentTier: string
}) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function checkout(tier: string) {
    setBusy(tier)
    setError(null)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error ?? "Could not start checkout. Please try again.")
    } catch {
      setError("Could not reach billing. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  async function openPortal() {
    setBusy("portal")
    setError(null)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error ?? "Could not open the billing portal.")
    } catch {
      setError("Could not reach billing. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Choose a plan</h2>
        <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-sm">
          {(["monthly", "annual"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                interval === i ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {i === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => {
          const price = interval === "monthly" ? p.monthly : p.annual
          const isCurrent = p.tier === currentTier
          return (
            <div key={p.tier} className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500">
                <span className="text-lg font-bold text-slate-900">{money(price)}</span>
                /{interval === "monthly" ? "mo" : "yr"}
              </p>
              <p className="mt-1 text-xs text-slate-400">{p.includedSeats} users included</p>
              <button
                type="button"
                onClick={() => checkout(p.tier)}
                disabled={busy !== null}
                className="mt-3 w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy === p.tier ? "Starting…" : isCurrent ? "Add payment method" : "Choose"}
              </button>
            </div>
          )
        })}
      </div>

      {hasStripeCustomer ? (
        <button
          type="button"
          onClick={openPortal}
          disabled={busy !== null}
          className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "portal" ? "Opening…" : "Manage billing & payment method"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </Card>
  )
}
