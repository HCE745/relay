"use client"

import { useState } from "react"
import { Mail, CheckCircle, Loader2 } from "lucide-react"

interface Props {
  issueId: string
  assigneeName: string
  assigneeEmail: string
}

export function NotifyAssigneeButton({ issueId, assigneeName, assigneeEmail }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function send() {
    setState("loading")
    const res = await fetch(`/api/issues/${issueId}/notify`, { method: "POST" })
    if (res.ok) {
      setState("done")
    } else {
      const d = await res.json()
      setErrorMsg(d.error ?? "Failed to send")
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 px-2 py-1.5">
        <CheckCircle className="w-3.5 h-3.5" />
        Email sent to {assigneeName}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={send}
        disabled={state === "loading"}
        title={`Send assignment email to ${assigneeEmail}`}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
      >
        {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        Notify by Email
      </button>
      {state === "error" && <p className="text-xs text-red-500">{errorMsg}</p>}
    </div>
  )
}
