"use client"

import { useState } from "react"
import { CheckCircle } from "lucide-react"

interface Props {
  currentSensitivity: string
}

const SENSITIVITY_OPTIONS = [
  {
    value: "LOW",
    label: "Low",
    description: "Match SOPs with 50%+ AI confidence. More matches, higher false-positive rate.",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    description: "Match SOPs with 65%+ confidence (recommended). Balanced precision and recall.",
  },
  {
    value: "HIGH",
    label: "High",
    description: "Match SOPs with 80%+ confidence. Fewer matches, lower false-positive rate.",
  },
]

export function SopSettingsForm({ currentSensitivity }: Props) {
  const [sensitivity, setSensitivity] = useState(currentSensitivity || "MEDIUM")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sopMatchSensitivity: sensitivity }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? "Failed to save")
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="space-y-2">
        <p className="text-sm text-gray-600 leading-relaxed">
          Controls the minimum AI confidence required before an SOP is automatically linked to a new issue.
          A higher threshold means fewer but more precise matches.
        </p>
        <div className="space-y-2 pt-1">
          {SENSITIVITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                sensitivity === opt.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="sopSensitivity"
                value={opt.value}
                checked={sensitivity === opt.value}
                onChange={() => setSensitivity(opt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  )
}
