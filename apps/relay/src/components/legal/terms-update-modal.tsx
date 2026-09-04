"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"

export function TermsUpdateModal() {
  const router = useRouter()
  const [accepted, setAccepted]   = useState(false)
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState("")

  async function handleContinue() {
    if (!accepted) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/legal/accept", { method: "POST" })
      if (!res.ok) throw new Error("Failed to record acceptance")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          We&rsquo;ve updated our terms
        </h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          We&rsquo;ve made updates to our Terms of Service and Privacy Policy. Please review and accept
          the updated terms to continue using Relay.
        </p>

        <div className="space-y-3 mb-6 text-sm">
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <span className="font-medium text-gray-700 group-hover:text-blue-700">Terms of Service</span>
            <span className="text-gray-400 text-xs">Opens in new tab →</span>
          </Link>
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <span className="font-medium text-gray-700 group-hover:text-blue-700">Privacy Policy</span>
            <span className="text-gray-400 text-xs">Opens in new tab →</span>
          </Link>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
          />
          <span className="text-sm text-gray-700">
            I have read and agree to the updated Terms of Service and Privacy Policy
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={!accepted || loading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {loading ? "Saving…" : "Continue to Relay"}
        </button>
      </div>
    </div>
  )
}
