"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Loader2, AlertCircle } from "lucide-react"
import { RelayWordmark } from "@/components/logo"

type PollState = "polling" | "active" | "timeout" | "error"

export function SuccessPoller({ sessionId }: { sessionId: string | null }) {
  const router = useRouter()
  const [state, setState] = useState<PollState>("polling")
  const [plan,  setPlan]  = useState<string>("")

  useEffect(() => {
    let attempts = 0
    const MAX = 10

    const poll = async () => {
      try {
        const res = await fetch("/api/subscription/status")
        if (!res.ok) { setState("error"); return }
        const data = await res.json() as { status: string; plan: string }
        if (data.status === "active") {
          setPlan(data.plan)
          setState("active")
          return
        }
      } catch {
        // transient network error — keep polling
      }

      attempts++
      if (attempts >= MAX) {
        setState("timeout")
        return
      }
      setTimeout(poll, 1000)
    }

    setTimeout(poll, 500)
  }, [])

  // Auto-redirect after showing success
  useEffect(() => {
    if (state !== "active") return
    const t = setTimeout(() => router.push("/dashboard"), 5000)
    return () => clearTimeout(t)
  }, [state, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <RelayWordmark height={28} />
        </div>

        {state === "polling" && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Activating your subscription…</h1>
            <p className="text-gray-500 text-sm">
              Please wait while we confirm your payment with Stripe. This takes just a moment.
            </p>
          </>
        )}

        {state === "active" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your {plan === "professional" ? "Professional" : plan === "essentials" ? "Essentials" : "Relay"} subscription
              is now active. Welcome to Relay.
            </p>
            <p className="text-xs text-gray-400 mb-6">Redirecting you to your dashboard in a few seconds…</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {state === "timeout" && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Almost there…</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your payment was received but we&apos;re still processing your subscription. Check your
              subscription page in a moment — it should be active shortly.
            </p>
            {sessionId && (
              <p className="text-xs text-gray-400 mb-4 font-mono">Ref: {sessionId.slice(-8)}</p>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/settings/subscription")}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Check Subscription Status
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full px-6 py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6">
              We couldn&apos;t verify your subscription status. If your payment went through, your
              account will be activated shortly. Please contact support if this persists.
            </p>
            <button
              onClick={() => router.push("/settings/subscription")}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Check Subscription Status
            </button>
          </>
        )}
      </div>
    </div>
  )
}
