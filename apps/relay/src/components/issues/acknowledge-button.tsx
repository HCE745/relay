"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { toast } from "@/lib/toast"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

interface Props {
  issueId: string
  priority: string
  acknowledgedAt: string | null
  acknowledgedByName: string | null
  sessionRole: string
}

const ELIGIBLE_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR"]
const ELIGIBLE_PRIORITIES = ["CRITICAL", "HIGH"]

export function AcknowledgeButton({ issueId, priority, acknowledgedAt, acknowledgedByName, sessionRole }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [localAckedAt, setLocalAckedAt] = useState(acknowledgedAt)
  const [localAckedBy, setLocalAckedBy] = useState(acknowledgedByName)

  if (!ELIGIBLE_PRIORITIES.includes(priority)) return null
  if (!ELIGIBLE_ROLES.includes(sessionRole)) return null

  if (localAckedAt) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
        <ShieldCheck className="w-4 h-4" />
        <span>
          Acknowledged{localAckedBy ? ` by ${localAckedBy}` : ""}{" "}
          <span className="text-xs text-green-500">
            {format(new Date(localAckedAt), "MMM d, h:mm a")}
          </span>
        </span>
      </div>
    )
  }

  async function handleAcknowledge() {
    setLoading(true)
    try {
      const res = await fetch(`/api/issues/${issueId}/acknowledge`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setLocalAckedAt(data.acknowledgedAt)
        toast.success("Issue acknowledged")
        router.refresh()
      } else {
        toast.error("Failed to acknowledge")
      }
    } catch {
      toast.error("Connection error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAcknowledge}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50 transition-colors disabled:opacity-60"
    >
      <ShieldCheck className="w-4 h-4" />
      {loading ? "…" : "Acknowledge"}
    </button>
  )
}
