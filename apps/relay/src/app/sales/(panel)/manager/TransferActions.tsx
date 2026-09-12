"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

export function TransferActions({ transferId }: { transferId: string }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)
  const [done, setDone] = useState<"approved" | "rejected" | null>(null)

  async function act(action: "approve" | "reject") {
    setLoading(action)
    try {
      const res = await fetch(`/api/sales/transfer/requests/${transferId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      setDone(action === "approve" ? "approved" : "rejected")
    } catch {
      alert(`Failed to ${action} transfer`)
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    return (
      <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${done === "approved" ? "bg-green-900/40 text-green-300" : "bg-gray-800 text-gray-400"}`}>
        {done === "approved" ? "Approved" : "Rejected"}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => act("approve")}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        {loading === "approve" && <Loader2 className="w-3 h-3 animate-spin" />}
        Approve
      </button>
      <button
        onClick={() => act("reject")}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
      >
        {loading === "reject" && <Loader2 className="w-3 h-3 animate-spin" />}
        Reject
      </button>
    </div>
  )
}
