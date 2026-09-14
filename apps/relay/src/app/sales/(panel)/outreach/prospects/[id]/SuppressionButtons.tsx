"use client"

import { ShieldOff, AlertTriangle } from "lucide-react"

export function SuppressionButtons({ email, prospectId }: { email: string; prospectId: string }) {
  async function addSuppression(reason: "UNSUBSCRIBE" | "DO_NOT_CONTACT") {
    const label = reason === "UNSUBSCRIBE" ? "Unsubscribe" : "Do Not Contact"
    if (!confirm(`Mark ${email} as ${label}? They will be suppressed from all future outreach.`)) return
    const res = await fetch("/api/sales/unsubscribe", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email,
        reason,
        source: "MANUAL",
        notes:  `Added from Prospect ${prospectId}`,
      }),
    })
    if (res.ok) {
      alert(`${email} has been suppressed (${label}).`)
    } else {
      const d = await res.json()
      alert(d.error ?? "Failed to add suppression record.")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => addSuppression("UNSUBSCRIBE")}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-700 text-xs rounded-lg transition-colors"
        title="Mark as unsubscribed"
      >
        <ShieldOff className="w-3.5 h-3.5" />
        Unsub
      </button>
      <button
        onClick={() => addSuppression("DO_NOT_CONTACT")}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-red-600 hover:border-red-800 text-xs rounded-lg transition-colors"
        title="Mark as Do Not Contact"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        DNC
      </button>
    </div>
  )
}
