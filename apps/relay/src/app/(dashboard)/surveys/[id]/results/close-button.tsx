"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, StopCircle } from "lucide-react"

export function CloseButton({ surveyId }: { surveyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  async function handleClose() {
    if (!confirm("Close this survey? It will stop accepting new responses.")) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/surveys/${surveyId}/close`, { method: "POST" })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Failed to close")
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <span className="text-xs text-red-600 mr-2">{error}</span>}
      <button
        onClick={handleClose}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
        Close Survey
      </button>
    </div>
  )
}
