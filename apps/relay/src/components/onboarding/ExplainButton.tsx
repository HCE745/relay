"use client"

import { useState } from "react"
import { HelpCircle, X, Loader2 } from "lucide-react"

interface ExplainButtonProps {
  field: string
  context?: string
}

export function ExplainButton({ field, context }: ExplainButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchExplanation() {
    if (text) { setOpen(true); return }
    setLoading(true)
    setOpen(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: `Explain this onboarding field in one or two plain sentences (no markdown): "${field}"${context ? ` Context: ${context}` : ""}. Reply with only the explanation.`,
          history: [],
        }),
      })
      const json = await res.json() as { type?: string; question?: string; error?: string }
      if (!res.ok) {
        setError(json.error ?? "Could not load explanation.")
      } else {
        // The AI will return a clarification which is the explanation text
        setText(json.question ?? "No explanation available.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={fetchExplanation}
        className="ml-1.5 text-gray-400 hover:text-blue-500 transition-colors align-middle"
        aria-label={`Explain ${field}`}
      >
        <HelpCircle className="w-3.5 h-3.5 inline" />
      </button>

      {open && (
        <div className="absolute z-20 left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-gray-700 leading-relaxed">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-gray-900 text-xs uppercase tracking-wide">{field}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-1.5">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            {error && <p className="text-red-600">{error}</p>}
            {text && !loading && <p>{text}</p>}
          </div>
        </div>
      )}
    </span>
  )
}
