"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EyeOff, AlertTriangle } from "lucide-react"

interface Props {
  repName: string
  expiresAt: string | null
}

export function ImpersonationBanner({ repName, expiresAt }: Props) {
  const router = useRouter()
  const [exiting, setExiting] = useState(false)

  async function handleExit() {
    setExiting(true)
    try {
      const res = await fetch("/api/super-admin/crm/exit-rep-impersonation", { method: "POST" })
      if (res.ok) {
        router.push("/super-admin/settings/sales-users")
        router.refresh()
      }
    } finally {
      setExiting(false)
    }
  }

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-sm font-medium shadow-lg">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Viewing CRM as <strong>{repName}</strong> — read only, email sending blocked
        {expiryLabel && <span className="ml-1 opacity-70">(expires {expiryLabel})</span>}
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 rounded px-3 py-1 bg-amber-800/20 hover:bg-amber-800/30 transition-colors disabled:opacity-50"
      >
        <EyeOff className="h-3.5 w-3.5" />
        {exiting ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  )
}
