"use client"

import { useEffect, useState } from "react"
import { Map, Compass, Loader2 } from "lucide-react"
import { useTour } from "./tour-context"
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

export function TourWelcomeModal() {
  const { hasSeenWelcome, isActive, markWelcomeSeen, startTour, setIndustry, industry } = useTour()
  const [selected, setSelected] = useState(industry)
  const [resetting, setResetting] = useState(false)

  // Sync selected when context industry changes (e.g. after page reload with fresh initialIndustry)
  useEffect(() => {
    setSelected(industry)
  }, [industry])

  // Handle URL params set by /demo and /tour routes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const autoStart  = params.get("autoStartTour") === "1"
    const skipModal  = params.get("skipWelcome")   === "1"
    if (autoStart || skipModal) {
      window.history.replaceState({}, "", "/dashboard")
      markWelcomeSeen()
      if (autoStart) startTour(1)
    }
  }, [markWelcomeSeen, startTour])

  if (hasSeenWelcome || isActive) return null

  async function handleAction(startGuided: boolean) {
    if (selected !== industry) {
      // Industry changed — reset the demo org before starting
      setResetting(true)
      try {
        await fetch("/api/demo/reset", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ industry: selected }),
        })
        // Reload so all page data reflects the re-seeded industry
        window.location.href = startGuided ? "/dashboard?autoStartTour=1" : "/dashboard"
      } catch {
        setResetting(false)
      }
      return
    }

    markWelcomeSeen()
    if (startGuided) startTour(1)
  }

  if (resetting) {
    return (
      <div className="fixed inset-0 z-[9500] bg-gray-950/90 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold text-sm">Configuring Relay for {selected}…</p>
          <p className="text-gray-500 text-xs mt-1">Setting up your industry-specific workspace</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9500] bg-gray-950/90 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-b border-gray-700 px-8 py-7 text-center">
          <div className="flex justify-center mb-4">
            <RelayWordmarkWhite height={34} />
          </div>
          <h1 className="text-xl font-bold text-white mb-1.5">Welcome to Relay</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            You're inside a live, fully interactive demo. Pick your industry and Relay configures itself for your type of business.
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
          {selected !== industry && (
            <p className="text-xs text-blue-400 mt-2.5 text-center">
              Demo will reconfigure for {selected} when you start
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-5 space-y-2.5">
          <button
            onClick={() => void handleAction(true)}
            className="w-full flex items-center gap-4 p-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors text-left group"
          >
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
              <Map className="w-4.5 h-4.5 w-[18px] h-[18px]" />
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
            onClick={() => void handleAction(false)}
            className="w-full flex items-center gap-4 p-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-left group"
          >
            <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-gray-600 transition-colors">
              <Compass className="w-[18px] h-[18px]" />
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
