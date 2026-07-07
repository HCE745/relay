"use client"

import { Suspense, useState, useEffect } from "react"
import { Loader2, AlertCircle, Lock, Map, Compass } from "lucide-react"
import { RelayWordmarkWhite } from "@/components/logo"

const INDUSTRIES = [
  { label: "Manufacturing",      emoji: "🏭" },
  { label: "Warehousing",        emoji: "📦" },
  { label: "Restaurant",         emoji: "🍽️" },
  { label: "Retail",             emoji: "🛍️" },
  { label: "Hospitality",        emoji: "🏨" },
  { label: "Healthcare",         emoji: "🏥" },
  { label: "Education",          emoji: "🎓" },
  { label: "Property Management", emoji: "🏢" },
  { label: "Self-Storage",       emoji: "📦" },
]

type GateState = "checking" | "open" | "locked"
type View      = "code" | "selecting"

function DemoPageInner() {
  const [gate, setGate]             = useState<GateState>("checking")
  const [view, setView]             = useState<View>("selecting")
  const [codeInput, setCodeInput]   = useState("")
  const [pendingCode, setPendingCode] = useState("")
  const [codeError, setCodeError]   = useState("")
  const [selected, setSelected]     = useState("Manufacturing")
  const [starting, setStarting]     = useState<"tour" | "explore" | null>(null)
  const [startError, setStartError] = useState("")

  useEffect(() => {
    fetch("/api/demo/gate")
      .then(r => r.json())
      .then((d: { required: boolean }) => {
        if (d.required) { setGate("locked"); setView("code") }
        else            { setGate("open");   setView("selecting") }
      })
      .catch(() => { setGate("open"); setView("selecting") })
  }, [])

  function handleCodeContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!codeInput.trim()) return
    setPendingCode(codeInput.trim())
    setCodeError("")
    setView("selecting")
  }

  async function startDemo(type: "tour" | "explore") {
    setStarting(type)
    setStartError("")
    try {
      const body: Record<string, string> = { industry: selected }
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
      window.location.href = type === "tour"
        ? "/dashboard?autoStartTour=1"
        : "/dashboard?skipWelcome=1"
    } catch {
      setStartError("Could not start the demo. Please try again.")
      setStarting(null)
    }
  }

  if (gate === "checking") {
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

  // ── Industry selector + action buttons ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-b border-gray-700 px-8 py-7 text-center">
          <div className="flex justify-center mb-4">
            <RelayWordmarkWhite height={34} />
          </div>
          <h1 className="text-xl font-bold text-white mb-1.5">Welcome to Relay</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            You&apos;re inside a live, fully interactive demo. Pick your industry and Relay configures itself for your type of business.
          </p>
        </div>

        {/* Industry selector */}
        <div className="px-6 pt-5 pb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your industry</p>
          <div className="grid grid-cols-2 gap-2">
            {INDUSTRIES.map(ind => (
              <button
                key={ind.label}
                onClick={() => setSelected(ind.label)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  selected === ind.label
                    ? "bg-blue-600/20 border-blue-500/60 text-white"
                    : "bg-gray-800/60 border-gray-700/60 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                }`}
              >
                <span className="text-base leading-none">{ind.emoji}</span>
                {ind.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-5 space-y-2.5">
          {startError && (
            <div className="flex items-center gap-2 text-red-400 text-sm justify-center mb-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {startError}
            </div>
          )}

          <button
            onClick={() => void startDemo("tour")}
            disabled={starting !== null}
            className="w-full flex items-center gap-4 p-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-70 text-white rounded-xl transition-colors text-left group"
          >
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
              {starting === "tour"
                ? <Loader2 className="w-[18px] h-[18px] animate-spin" />
                : <Map className="w-[18px] h-[18px]" />}
            </div>
            <div>
              <p className="font-semibold text-sm">Start Guided Tour</p>
              <p className="text-blue-200 text-xs mt-0.5">About 2 minutes · Audio-guided · Pause anytime</p>
            </div>
            <span className="ml-auto text-xs bg-white/15 text-white px-2 py-0.5 rounded-full shrink-0">
              Recommended
            </span>
          </button>

          <button
            onClick={() => void startDemo("explore")}
            disabled={starting !== null}
            className="w-full flex items-center gap-4 p-3.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-70 text-gray-300 rounded-xl transition-colors text-left group"
          >
            <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-gray-600 transition-colors">
              {starting === "explore"
                ? <Loader2 className="w-[18px] h-[18px] animate-spin" />
                : <Compass className="w-[18px] h-[18px]" />}
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Explore on My Own</p>
              <p className="text-gray-500 text-xs mt-0.5">Browse freely — start the tour anytime from the demo panel</p>
            </div>
          </button>
        </div>

        <p className="text-xs text-gray-600 text-center pb-4">
          No account or credit card required · Demo resets every 2 hours
        </p>
      </div>
    </div>
  )
}

export default function DemoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
      </div>
    }>
      <DemoPageInner />
    </Suspense>
  )
}
