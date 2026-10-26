"use client"

import { useState } from "react"
import { Target, X, Loader2, CheckCircle2 } from "lucide-react"

type Answer = "yes" | "no" | "unknown"

interface Props {
  opportunityId:       string
  currentScore?:       number | null
  currentStatus?:      string | null
  onQualified?:        (score: number, status: string) => void
}

const QUESTIONS = [
  { key: "hasMeasurableProblem", label: "They have a measurable operational problem" },
  { key: "hasBudget",            label: "They have budget or can allocate it" },
  { key: "hasDecisionMaker",     label: "A decision maker is engaged" },
  { key: "hasTimeline",          label: "They have a defined timeline" },
  { key: "fitsUseCase",          label: "Relay fits their use case" },
] as const

const STATUS_COLOR: Record<string, string> = {
  UNQUALIFIED:        "text-red-400 bg-red-900/20",
  MARKETING_QUALIFIED: "text-amber-400 bg-amber-900/20",
  SALES_QUALIFIED:    "text-emerald-400 bg-emerald-900/20",
  DISQUALIFIED:       "text-gray-400 bg-gray-800",
}

export function QualifyButton({ opportunityId, currentScore, currentStatus, onQualified }: Props) {
  const [open, setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [answers, setAnswers] = useState<Record<string, Answer>>({
    hasMeasurableProblem: "unknown",
    hasBudget:            "unknown",
    hasDecisionMaker:     "unknown",
    hasTimeline:          "unknown",
    fitsUseCase:          "unknown",
  })
  const [disqualReason, setDisqualReason] = useState("")

  const yesCount = Object.values(answers).filter(a => a === "yes").length
  const previewScore = yesCount * 20

  async function submit() {
    setSaving(true)
    const res = await fetch(`/api/sales/opportunities/${opportunityId}/qualify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...answers, disqualifiedReason: disqualReason || undefined }),
    })
    if (res.ok) {
      const data = await res.json() as { qualificationScore: number; qualificationStatus: string }
      onQualified?.(data.qualificationScore, data.qualificationStatus)
      setOpen(false)
    }
    setSaving(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {currentStatus && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[currentStatus] ?? "text-gray-400 bg-gray-800"}`}>
            {currentStatus.replace(/_/g, " ")}
          </span>
        )}
        {currentScore != null && (
          <span className="text-[10px] text-gray-500">{currentScore}/100</span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Target className="w-3.5 h-3.5" />
          Qualify (MEDDIC)
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                MEDDIC Qualification
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {QUESTIONS.map(q => (
                <div key={q.key}>
                  <p className="text-xs text-gray-300 mb-2">{q.label}</p>
                  <div className="flex gap-2">
                    {(["yes", "no", "unknown"] as Answer[]).map(a => (
                      <button
                        key={a}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.key]: a }))}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                          answers[q.key as keyof typeof answers] === a
                            ? a === "yes" ? "bg-emerald-600 text-white"
                            : a === "no"  ? "bg-red-700 text-white"
                            : "bg-gray-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {a === "unknown" ? "?" : a.charAt(0).toUpperCase() + a.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">Score preview</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${previewScore >= 80 ? "bg-emerald-500" : previewScore >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${previewScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white">{previewScore}/100</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Disqualified Reason (optional)</label>
                <input
                  value={disqualReason}
                  onChange={e => setDisqualReason(e.target.value)}
                  placeholder="Leave blank unless disqualifying..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-white px-3 py-1.5">Cancel</button>
              <button
                onClick={submit}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Save Qualification
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
