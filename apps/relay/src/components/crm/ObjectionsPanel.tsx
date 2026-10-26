"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Plus, CheckCircle2, X, Loader2 } from "lucide-react"

interface Objection {
  id:             string
  objectionType:  string
  objectionText:  string
  responseGiven:  string | null
  wasResolved:    boolean
  createdAt:      string
  salesUser:      { id: string; name: string }
}

const OBJECTION_TYPES = [
  "PRICE", "BUDGET", "TIMING", "COMPETITOR", "NO_PAIN",
  "TECHNICAL", "COMPLIANCE", "INTERNAL_POLITICS", "OTHER",
]

interface Props {
  prospectId?:    string
  demoCallId?:    string
  opportunityId?: string
}

export function ObjectionsPanel({ prospectId, demoCallId, opportunityId }: Props) {
  const [objections, setObjections] = useState<Objection[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [type, setType]             = useState("PRICE")
  const [text, setText]             = useState("")
  const [response, setResponse]     = useState("")
  const [saving, setSaving]         = useState(false)

  async function load() {
    const params = new URLSearchParams()
    if (prospectId)    params.set("prospectId",    prospectId)
    if (demoCallId)    params.set("demoCallId",    demoCallId)
    if (opportunityId) params.set("opportunityId", opportunityId)
    setLoading(true)
    const res = await fetch(`/api/sales/objections?${params}`)
    if (res.ok) {
      const data = await res.json() as { objections: Objection[] }
      setObjections(data.objections)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [prospectId, demoCallId, opportunityId])

  async function addObjection() {
    if (!text.trim()) return
    setSaving(true)
    const res = await fetch("/api/sales/objections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId, demoCallId, opportunityId,
        objectionType: type,
        objectionText: text,
        responseGiven: response || undefined,
      }),
    })
    if (res.ok) {
      setShowForm(false); setText(""); setResponse("")
      await load()
    }
    setSaving(false)
  }

  async function toggleResolved(obj: Objection) {
    await fetch(`/api/sales/objections/${obj.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wasResolved: !obj.wasResolved }),
    })
    await load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Objections
          {objections.length > 0 && (
            <span className="text-[10px] bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full">
              {objections.filter(o => !o.wasResolved).length} open
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Objection
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Objection Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none"
            >
              {OBJECTION_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">What They Said</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={2}
              placeholder="Quote or paraphrase..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 resize-none focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Your Response (optional)</label>
            <textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              rows={2}
              placeholder="How did you respond?"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 resize-none focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
            <button
              onClick={addObjection}
              disabled={saving || !text.trim()}
              className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-gray-500 py-2 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading...
        </div>
      ) : objections.length === 0 ? (
        <p className="text-xs text-gray-600 py-2">No objections logged yet.</p>
      ) : (
        <div className="space-y-2">
          {objections.map(obj => (
            <div key={obj.id} className={`rounded-xl p-3 border ${obj.wasResolved ? "border-emerald-900/30 bg-emerald-900/10" : "border-amber-900/30 bg-amber-900/10"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                      {obj.objectionType.replace(/_/g, " ")}
                    </span>
                    {obj.wasResolved && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-200">&ldquo;{obj.objectionText}&rdquo;</p>
                  {obj.responseGiven && (
                    <p className="text-[11px] text-gray-500 mt-1">Response: {obj.responseGiven}</p>
                  )}
                  <p className="text-[10px] text-gray-600 mt-1">
                    {obj.salesUser.name} · {new Date(obj.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => void toggleResolved(obj)}
                  className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-lg transition-colors ${
                    obj.wasResolved
                      ? "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      : "bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70"
                  }`}
                >
                  {obj.wasResolved ? "Reopen" : "Resolve"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
