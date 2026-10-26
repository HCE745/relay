"use client"

import { useState } from "react"
import { Phone, X, Loader2, CheckCircle2 } from "lucide-react"

const CALL_OUTCOMES = [
  { value: "NO_ANSWER",          label: "No Answer" },
  { value: "LEFT_VOICEMAIL",     label: "Left Voicemail" },
  { value: "GATEKEEPER",         label: "Gatekeeper" },
  { value: "WRONG_CONTACT",      label: "Wrong Contact" },
  { value: "INTERESTED",         label: "Interested" },
  { value: "NOT_INTERESTED",     label: "Not Interested" },
  { value: "CALLBACK_REQUESTED", label: "Callback Requested" },
  { value: "MEETING_BOOKED",     label: "Meeting Booked" },
  { value: "ALREADY_A_CUSTOMER", label: "Already a Customer" },
  { value: "DO_NOT_CALL",        label: "Do Not Call" },
]

const CONNECTED_OUTCOMES = ["INTERESTED", "NOT_INTERESTED", "CALLBACK_REQUESTED", "MEETING_BOOKED", "ALREADY_A_CUSTOMER", "DO_NOT_CALL"]

interface Props {
  prospectId?:    string
  demoCallId?:    string
  opportunityId?: string
  onClose:        () => void
  onLogged?:      () => void
}

export function LogCallModal({ prospectId, demoCallId, opportunityId, onClose, onLogged }: Props) {
  const [direction, setDirection] = useState<"OUTBOUND" | "INBOUND">("OUTBOUND")
  const [outcome, setOutcome]     = useState("NO_ANSWER")
  const [contact, setContact]     = useState("")
  const [duration, setDuration]   = useState("")
  const [notes, setNotes]         = useState("")
  const [saving, setSaving]       = useState(false)

  const isConnected = CONNECTED_OUTCOMES.includes(outcome)
  const activityType = isConnected ? "CALL_CONNECTED" : "CALL_ATTEMPTED"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/sales/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId, demoCallId, opportunityId,
        activityType,
        subject:        contact ? `${direction === "OUTBOUND" ? "Called" : "Received call from"} ${contact}` : `${direction} call`,
        notes,
        outcome,
        durationMinutes: duration ? Number(duration) : undefined,
        metadata:        { direction },
      }),
    })
    setSaving(false)
    if (res.ok) {
      onLogged?.()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400" />
            Log Call
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Direction</label>
            <div className="flex gap-2">
              {(["OUTBOUND", "INBOUND"] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    direction === d ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {d === "OUTBOUND" ? "Outbound (I called)" : "Inbound (They called)"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Outcome</label>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none"
            >
              {CALL_OUTCOMES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-600 mt-1">
              Activity type: <span className={`font-medium ${isConnected ? "text-emerald-400" : "text-gray-400"}`}>{activityType.replace(/_/g, " ")}</span>
            </p>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Contact Spoken With</label>
            <input
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="Name (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Duration (minutes)</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="What happened on the call?"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 resize-none focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-white px-3 py-1.5">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Log Call
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
