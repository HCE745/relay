"use client"

import { useState } from "react"
import { Building2, Mail, CheckCircle2, XCircle, PlayCircle } from "lucide-react"

type OrgInfo = { id: string; name: string; lifecycleStatus: string } | null

type DemoCallInfo = {
  id: string
  contactName: string
  contactEmail: string
  companyName: string | null
  contactRole: string | null
  callStatus: string
  organization: OrgInfo
}

export type EnrollmentCardData = {
  id: string
  status: string
  stopReason: string | null
  stoppedAt: string | null
  enrolledAt: string
  lastContactAt: string | null
  currentStep: number
  sequence: { id: string; name: string }
  demoCall: DemoCallInfo
  followUps?: { sentAt: string | null; stepNumber: number }[]
}

export function EnrollmentCard({
  enrollment,
  type,
}: {
  enrollment: EnrollmentCardData
  type: "waiting" | "paused" | "completed"
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const { demoCall, sequence } = enrollment
  const company = demoCall.companyName ?? demoCall.organization?.name ?? "Unknown"

  async function enrollmentAction(act: "pause" | "resume" | "stop") {
    setBusy(true); setError("")
    try {
      const r = await fetch(`/api/super-admin/crm/enrollments/${enrollment.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: act }),
      })
      if (r.ok) { setDone(true); window.location.reload() }
      else {
        const d = await r.json() as { error?: string }
        setError(d.error ?? "Action failed")
      }
    } catch {
      setError("Network error")
    } finally {
      setBusy(false)
    }
  }

  const lastSent = enrollment.followUps?.[0]

  const stopBadge = (() => {
    if (enrollment.status === "completed") return { label: "Completed", cls: "bg-blue-900/40 text-blue-300 border-blue-700/30" }
    switch (enrollment.stopReason) {
      case "reply":          return { label: "Replied",          cls: "bg-green-900/40 text-green-400 border-green-700/30" }
      case "not_interested": return { label: "Not Interested",   cls: "bg-gray-700 text-gray-400 border-gray-600" }
      case "manual":         return { label: "Stopped",          cls: "bg-gray-700 text-gray-400 border-gray-600" }
      default:               return { label: enrollment.stopReason ?? "Stopped", cls: "bg-gray-700 text-gray-400 border-gray-600" }
    }
  })()

  if (done) return null

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-white">{demoCall.contactName}</span>
          {demoCall.contactRole && (
            <span className="text-xs text-gray-400">· {demoCall.contactRole}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-400">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{company}</span>
          <span className="text-gray-600">·</span>
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs truncate">{demoCall.contactEmail}</span>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
          <span className="bg-indigo-900/40 text-indigo-300 border border-indigo-700/30 px-2 py-0.5 rounded">
            {sequence.name} · Step {enrollment.currentStep}
          </span>
          {type === "waiting" && enrollment.lastContactAt && (
            <span className="text-gray-500">
              Last: {new Date(enrollment.lastContactAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {type === "paused" && (
            <span className="bg-yellow-900/40 text-yellow-400 border border-yellow-700/30 px-2 py-0.5 rounded">
              Paused
            </span>
          )}
          {type === "completed" && (
            <span className={`border px-2 py-0.5 rounded ${stopBadge.cls}`}>
              {stopBadge.label}
            </span>
          )}
          {lastSent?.sentAt && (
            <span className="text-gray-500">
              Step {lastSent.stepNumber} sent {new Date(lastSent.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>

      {type !== "completed" && (
        <div className="flex items-center gap-2 shrink-0">
          {type === "paused" ? (
            <>
              <button
                onClick={() => void enrollmentAction("resume")}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Resume
              </button>
              <button
                onClick={() => { if (confirm(`Stop sequence for ${demoCall.contactName} permanently?`)) void enrollmentAction("stop") }}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                End
              </button>
            </>
          ) : (
            /* waiting */
            <button
              onClick={() => void enrollmentAction("pause")}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pause
            </button>
          )}
        </div>
      )}
    </div>
  )
}
