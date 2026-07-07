"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LIFECYCLE_STAGES, LIFECYCLE_COLORS } from "@/lib/crm-lifecycle-constants"

interface Props {
  orgId:          string
  currentStatus:  string
}

export function CrmLifecycleSelector({ orgId, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState(currentStatus)

  async function handleChange(next: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/lifecycle`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setStatus(next)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  const colorClass = LIFECYCLE_COLORS[status] ?? "bg-gray-100 text-gray-700"

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {status}
      </span>
      <select
        disabled={loading}
        value={status}
        onChange={e => handleChange(e.target.value)}
        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {LIFECYCLE_STAGES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {loading && <span className="text-xs text-gray-400">Saving…</span>}
    </div>
  )
}
