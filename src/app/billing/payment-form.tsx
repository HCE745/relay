"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Zap, Loader2, Check, CreditCard } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Props {
  orgName: string
  trialEndsAt: string | null
  publishableKey: string
}

// ── Inner form (inside <Elements>) ───────────────────────────────────────────
function CheckoutForm() {
  const stripe    = useStripe()
  const elements  = useElements()
  const router    = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError("")

    try {
      // Confirm the SetupIntent — card-only flows don't redirect
      const { error: stripeError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.origin + "/billing" },
        redirect: "if_required",
      })

      if (stripeError) {
        setError(stripeError.message ?? "Payment setup failed.")
        return
      }

      // Tell our server to create the subscription and activate the org
      const res = await fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupIntentId: setupIntent?.id }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError((json).error ?? "Failed to activate subscription.")
        return
      }

      router.push("/dashboard")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Activating…
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Start Subscription
          </>
        )}
      </button>
    </form>
  )
}

// ── Outer wrapper — loads Stripe and fetches client secret ────────────────────
export function PaymentForm({ orgName, trialEndsAt, publishableKey }: Props) {
  const [clientSecret, setClientSecret] = useState("")
  const [fetchError,   setFetchError]   = useState("")

  useEffect(() => {
    if (!publishableKey) return // Stripe not configured

    fetch("/api/billing/setup-intent", { method: "POST" })
      .then((r) => r.json())
      .then((j) => {
        if (j.clientSecret) setClientSecret(j.clientSecret)
        else setFetchError(j.error ?? "Could not initialise payment.")
      })
      .catch(() => setFetchError("Network error. Please refresh."))
  }, [publishableKey])

  const stripePromise = publishableKey ? loadStripe(publishableKey) : null

  const trialEndDate = trialEndsAt ? new Date(trialEndsAt) : null
  const trialExpiredAgo = trialEndDate
    ? formatDistanceToNow(trialEndDate, { addSuffix: true })
    : null

  const PERKS = [
    "Issue tracking, routing, and resolution management",
    "Asset & equipment management with maintenance logs",
    "Vendor management and SOP management",
    "Injury & safety reporting",
    "Advanced analytics & reporting",
    "Mobile app with offline support",
    "Automated routing, escalations, and notifications",
  ]

  return (
    <div>
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">Relay</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Your free trial has ended</h1>
          {trialExpiredAgo && (
            <p className="text-sm text-gray-500 mt-1">
              Your trial for <span className="font-medium text-gray-700">{orgName}</span> expired{" "}
              {trialExpiredAgo}. Add a payment method to continue.
            </p>
          )}
        </div>

        {/* Perks */}
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
            What&apos;s included
          </p>
          <ul className="space-y-1.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-blue-900">
                <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Payment form */}
        {!publishableKey ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <strong>Billing not configured.</strong> Set{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">
              NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
            </code>{" "}
            and{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">
              STRIPE_SECRET_KEY
            </code>{" "}
            in your environment to enable payments.
          </div>
        ) : fetchError ? (
          <p className="text-sm text-red-600">{fetchError}</p>
        ) : !clientSecret ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: { colorPrimary: "#2563eb", borderRadius: "12px" },
              },
            }}
          >
            <CheckoutForm />
          </Elements>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Secured by Stripe. Your card details are never stored on our servers.
      </p>
    </div>
  )
}
