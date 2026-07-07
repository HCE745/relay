"use client"

import { useState } from "react"
import { FlaskConical, Play, Loader2 } from "lucide-react"

export function TestingActions() {
  const [demoLoading, setDemoLoading] = useState(false)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [error, setError] = useState("")

  async function enterDemoMode() {
    setDemoLoading(true)
    setError("")
    // Bypass access code — super admins go straight in
    const res = await fetch("/api/demo/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ superAdminBypass: true }) })
    setDemoLoading(false)
    if (res.ok) {
      window.open("/dashboard", "_blank")
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? "Failed to start demo")
    }
  }

  async function testOnboarding() {
    setOnboardingLoading(true)
    setError("")
    const res = await fetch("/api/super-admin/test-session", { method: "POST" })
    setOnboardingLoading(false)
    if (res.ok) {
      window.open("/onboarding", "_blank")
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? "Failed to create test session")
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-3 mb-1">
        <FlaskConical className="w-5 h-5 text-purple-400" />
        <h2 className="text-white font-semibold">Testing</h2>
      </div>
      <p className="text-gray-400 text-sm mb-5">
        Test the app experience without touching real data. Sessions open in a new tab and are auto-cleaned up.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={enterDemoMode}
          disabled={demoLoading || onboardingLoading}
          className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-indigo-900 hover:bg-indigo-800 border border-indigo-700 text-indigo-200 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {demoLoading
            ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            : <Play className="w-4 h-4 shrink-0" />}
          <div className="text-left">
            <div>Enter Demo Mode</div>
            <div className="text-xs text-indigo-400 font-normal">Full demo org, pre-seeded data</div>
          </div>
        </button>

        <button
          onClick={testOnboarding}
          disabled={demoLoading || onboardingLoading}
          className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-purple-900 hover:bg-purple-800 border border-purple-700 text-purple-200 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {onboardingLoading
            ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            : <FlaskConical className="w-4 h-4 shrink-0" />}
          <div className="text-left">
            <div>Test Onboarding Wizard</div>
            <div className="text-xs text-purple-400 font-normal">Fresh org, end-to-end setup flow</div>
          </div>
        </button>
      </div>
    </div>
  )
}
