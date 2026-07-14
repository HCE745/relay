"use client"

import { useState, useRef, useEffect } from "react"
import { MoreHorizontal, CheckCircle2, XCircle, PauseCircle, PlayCircle, AlertTriangle, ShieldOff, StickyNote, ChevronRight } from "lucide-react"

type Status = "pending" | "qualifying" | "qualified" | "rewarded" | "cancelled" | "disqualified" | "paused"

interface Props {
  referralId: string
  status: string
  fraudReview: boolean
}

export function SAReferralActions({ referralId, status, fraudReview }: Props) {
  const [open, setOpen]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const [done, setDone]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const s = status as Status
  const canQualify      = ["pending", "qualifying"].includes(s)
  const canPause        = ["pending", "qualifying"].includes(s)
  const canResume       = s === "paused"
  const canDisqualify   = !["rewarded", "cancelled", "disqualified"].includes(s)
  const canCancel       = !["rewarded", "cancelled", "disqualified"].includes(s)

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setBusy(true)
    setOpen(false)
    try {
      await fetch(`/api/super-admin/referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      setDone(true)
      setTimeout(() => window.location.reload(), 600)
    } catch {
      setBusy(false)
    }
  }

  async function promptAndAction(action: string, promptText: string, field: string) {
    const val = window.prompt(promptText)
    if (val === null) return
    await doAction(action, { [field]: val || undefined })
  }

  if (done) return <span className="text-xs text-green-400">Done ✓</span>
  if (busy) return <span className="text-xs text-gray-500">Working…</span>

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        title="Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 text-sm">
          {canQualify && (
            <button onClick={() => doAction("qualify")}
              className="w-full flex items-center gap-2 px-3 py-2 text-green-400 hover:bg-gray-700 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Qualify now
            </button>
          )}
          {canPause && (
            <button onClick={() => doAction("pause")}
              className="w-full flex items-center gap-2 px-3 py-2 text-yellow-400 hover:bg-gray-700 transition-colors">
              <PauseCircle className="w-3.5 h-3.5" /> Pause
            </button>
          )}
          {canResume && (
            <button onClick={() => doAction("resume")}
              className="w-full flex items-center gap-2 px-3 py-2 text-blue-400 hover:bg-gray-700 transition-colors">
              <PlayCircle className="w-3.5 h-3.5" /> Resume
            </button>
          )}
          {canDisqualify && (
            <button onClick={() => promptAndAction("disqualify", "Reason for disqualification:", "reason")}
              className="w-full flex items-center gap-2 px-3 py-2 text-orange-400 hover:bg-gray-700 transition-colors">
              <XCircle className="w-3.5 h-3.5" /> Disqualify
            </button>
          )}
          {canCancel && (
            <button onClick={() => doAction("cancel")}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-gray-700 transition-colors">
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
          <div className="border-t border-gray-700 my-1" />
          {!fraudReview ? (
            <button onClick={() => promptAndAction("flag_fraud", "Fraud notes (optional):", "note")}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-300 hover:bg-gray-700 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" /> Flag for fraud
            </button>
          ) : (
            <button onClick={() => doAction("unflag_fraud")}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 transition-colors">
              <ShieldOff className="w-3.5 h-3.5" /> Unflag fraud
            </button>
          )}
          <button onClick={() => promptAndAction("add_note", "Internal note:", "note")}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-gray-700 transition-colors">
            <StickyNote className="w-3.5 h-3.5" /> Add note
          </button>
          <div className="border-t border-gray-700 my-1" />
          <a href={`/super-admin/referrals/${referralId}`}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
            <ChevronRight className="w-3.5 h-3.5" /> View detail
          </a>
        </div>
      )}
    </div>
  )
}
