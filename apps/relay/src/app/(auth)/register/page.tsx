"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { register } from "@/lib/auth-actions"
import { RelayWordmark } from "@/components/logo"
import { Tag, CheckCircle } from "lucide-react"

type OfferDetails = {
  offerType: string
  discountPercent: number | null
  flatMonthlyPrice: number | null
  freeMonths: number | null
  durationMonths: number | null
  targetPlan: string
}

const PLAN_LABELS: Record<string, string> = {
  essentials:        "Essentials",
  professional:      "Professional",
  professional_plus: "Professional Plus",
  wash_essentials:   "Wash Essentials",
}

function OfferBanner({ offer }: { offer: OfferDetails }) {
  function describe() {
    if (offer.offerType === "PERCENT_DISCOUNT") {
      const dur = offer.durationMonths ? ` for ${offer.durationMonths} months` : " forever"
      return `${offer.discountPercent}% off the ${PLAN_LABELS[offer.targetPlan] ?? offer.targetPlan} plan${dur}`
    }
    if (offer.offerType === "FLAT_PRICE") {
      return `${PLAN_LABELS[offer.targetPlan] ?? offer.targetPlan} plan at $${offer.flatMonthlyPrice}/month`
    }
    if (offer.offerType === "FREE_MONTHS") {
      return `${offer.freeMonths} free month${(offer.freeMonths ?? 1) !== 1 ? "s" : ""} on the ${PLAN_LABELS[offer.targetPlan] ?? offer.targetPlan} plan`
    }
    return "Special pricing offer applied"
  }

  return (
    <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
      <Tag className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-emerald-800">Special offer applied</p>
        <p className="text-sm text-emerald-700 mt-0.5">{describe()}</p>
        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Pricing will be applied automatically when you subscribe
        </p>
      </div>
    </div>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const offerToken = searchParams.get("offer")

  const [error, setError]               = useState("")
  const [loading, setLoading]           = useState(false)
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [offer, setOffer]               = useState<OfferDetails | null>(null)
  const [offerInvalid, setOfferInvalid] = useState(false)

  const validateOffer = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/offers/validate?token=${encodeURIComponent(token)}`)
      if (res.ok) {
        const data = await res.json()
        setOffer(data)
      } else {
        setOfferInvalid(true)
      }
    } catch {
      setOfferInvalid(true)
    }
  }, [])

  useEffect(() => {
    if (offerToken) validateOffer(offerToken)
  }, [offerToken, validateOffer])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    if (offerToken && offer) {
      formData.set("offerToken", offerToken)
    }
    const result = await register(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your organization</h2>
      <p className="text-gray-500 mb-6">Get started with Relay in minutes</p>

      {offer && <OfferBanner offer={offer} />}

      {offerInvalid && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          The offer link you used is invalid or has already been redeemed. You can still sign up at standard pricing.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Organization Name
          </label>
          <input
            name="orgName"
            type="text"
            required
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
          <input
            name="name"
            type="text"
            required
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="John Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Min. 8 characters"
          />
        </div>
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(e) => setLegalAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to the{" "}
              <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
          <p className="text-xs text-gray-400 leading-relaxed pl-7">
            By creating an account, you acknowledge that Relay includes{" "}
            <Link href="/legal/ai-usage" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              AI-powered features
            </Link>{" "}
            whose recommendations are advisory only.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !legalAccepted}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {loading ? "Creating…" : "Create Organization"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <RelayWordmark height={40} />
        </div>
        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your organization</h2>
            <p className="text-gray-500">Loading…</p>
          </div>
        }>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  )
}
