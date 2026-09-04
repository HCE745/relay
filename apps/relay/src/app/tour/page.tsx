"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, AlertCircle, Lock } from "lucide-react"
import { RelayWordmarkWhite } from "@/components/logo"

function track(payload: Record<string, unknown>) {
  return fetch("/api/demo-analytics/track", {
    method:    "POST",
    headers:   { "Content-Type": "application/json" },
    body:      JSON.stringify({ page: "tour", ...payload }),
    keepalive: true,
  }).catch(() => null)
}

const INDUSTRIES = [
  { label: "Manufacturing",       emoji: "🏭" },
  { label: "Warehousing",         emoji: "📦" },
  { label: "Property Management", emoji: "🏢" },
  { label: "Hospitality",         emoji: "🏨" },
  { label: "Retail",              emoji: "🛍️" },
  { label: "Car Wash",            emoji: "🚗" },
  { label: "Healthcare",          emoji: "🏥" },
  { label: "Construction",        emoji: "🏗️" },
  { label: "Other",               emoji: "⚙️" },
]

const SLUG_TO_INDUSTRY: Record<string, string> = {
  "manufacturing":       "Manufacturing",
  "warehousing":         "Warehousing",
  "property-management": "Property Management",
  "hospitality":         "Hospitality",
  "retail":              "Retail",
  "car-wash":            "Car Wash",
  "healthcare":          "Healthcare",
  "construction":        "Construction",
  "other":               "Other",
}

type GateState = "checking" | "open" | "locked"
type View      = "code" | "selecting" | "autostart"

function TourPageInner() {
  const searchParams   = useSearchParams()
  const industrySlug   = searchParams.get("industry")
  const preIndustry    = industrySlug ? (SLUG_TO_INDUSTRY[industrySlug] ?? null) : null

  const [gate,       setGate]       = useState<GateState>("checking")
  const [view,       setView]       = useState<View>("selecting")
  const [codeInput,  setCodeInput]  = useState("")
  const [pendingCode,setPendingCode]= useState("")
  const [codeError,  setCodeError]  = useState("")
  const [starting,   setStarting]   = useState<string | null>(null)
  const [startError, setStartError] = useState("")
  const autoStarted  = useRef(false)
  const tracked      = useRef(false)

  // Record page visit once on mount
  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    void track({})
  }, [])

  useEffect(() => {
    fetch("/api/demo/gate")
      .then(r => r.json())
      .then((d: { required: boolean }) => {
        if (d.required) {
          setGate("locked")
          setView("code")
        } else {
          setGate("open")
          if (preIndustry && !autoStarted.current) {
            autoStarted.current = true
            setView("autostart")
            void startTour(preIndustry)
          } else {
            setView("selecting")
          }
        }
      })
      .catch(() => {
        setGate("open")
        if (preIndustry && !autoStarted.current) {
          autoStarted.current = true
          setView("autostart")
          void startTour(preIndustry)
        } else {
          setView("selecting")
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCodeContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!codeInput.trim()) return
    setPendingCode(codeInput.trim())
    setCodeError("")
    if (preIndustry) {
      setView("autostart")
      void startTour(preIndustry)
    } else {
      setView("selecting")
    }
  }

  async function startTour(industry: string) {
    setStarting(industry)
    setStartError("")
    try {
      const body: Record<string, string> = { industry }
      if (pendingCode) body.accessCode = pendingCode
      const res = await fetch("/api/demo/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      if (res.status === 403) {
        setCodeError("Incorrect access code. Please try again.")
        setPendingCode("")
        setCodeInput("")
        setView("code")
        setStarting(null)
        return
      }
      if (!res.ok) throw new Error()
      // Track industry before navigating away
      await track({ industrySelected: industry })
      window.location.href = "/dashboard?autoStartTour=1"
    } catch {
      setStartError("Could not start the demo. Please try again.")
      setStarting(null)
      setView("selecting")
    }
  }

  // Loading / autostart spinner
  if (gate === "checking" || view === "autostart") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
      </div>
    )
  }

  // ── Access code entry ────────────────────────────────────────────────────────
  if (view === "code") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm w-full">
          <div className="flex items-center justify-center mb-8">
            <RelayWordmarkWhite height={48} />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-5 h-5 text-gray-400" />
            </div>
            <h1 className="text-lg font-bold text-white mb-1">Demo Access</h1>
            <p className="text-gray-500 text-sm mb-6">
              Enter the access code provided by your Relay contact.
            </p>
            <form onSubmit={handleCodeContinue} className="space-y-3">
              <input
                type="password"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                placeholder="Access code"
                autoComplete="off"
                autoFocus
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest"
              />
              {codeError && (
                <div className="flex items-center gap-2 text-red-400 text-xs justify-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {codeError}
                </div>
              )}
              <button
                type="submit"
                disabled={!codeInput.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Continue
              </button>
            </form>
          </div>
          <p className="text-gray-700 text-xs mt-4">No account or credit card required.</p>
        </div>
      </div>
    )
  }

  // ── Industry selection ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="flex justify-center mb-8">
          <RelayWordmarkWhite height={34} />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          What industry are you in?
        </h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          We&apos;ll customize the demo for your operation.
        </p>

        {startError && (
          <div className="flex items-center gap-2 text-red-400 text-sm justify-center mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {startError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {INDUSTRIES.map(ind => (
            <button
              key={ind.label}
              onClick={() => void startTour(ind.label)}
              disabled={starting !== null}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all border ${
                starting === ind.label
                  ? "bg-blue-600/30 border-blue-500/60 text-white"
                  : "bg-gray-800/60 border-gray-700/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600 hover:text-white"
              } disabled:opacity-60`}
            >
              <span className="text-2xl leading-none shrink-0">{ind.emoji}</span>
              <span className="font-semibold text-sm">{ind.label}</span>
              {starting === ind.label && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto shrink-0 text-blue-400" />
              )}
            </button>
          ))}
        </div>

        <p className="text-gray-700 text-xs mt-8">
          No account or credit card required · Demo resets every 2 hours
        </p>
      </div>
    </div>
  )
}

export default function TourPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
      </div>
    }>
      <TourPageInner />
    </Suspense>
  )
}
