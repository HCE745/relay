"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, LogOut, Loader2 } from "lucide-react"

interface Props {
  superAdminName: string
  orgName: string
}

export function ImpersonationBanner({ superAdminName, orgName }: Props) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)

  async function exit() {
    setLoading(true)
    await fetch("/api/super-admin/exit-impersonation", { method: "POST" })
    window.location.href = "/super-admin"
  }

  return (
    <div className="w-full bg-amber-500 text-amber-950 flex items-center justify-between px-4 py-2 text-sm font-medium md:pl-64">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 shrink-0" />
        <span>
          <strong>{superAdminName}</strong> is viewing as admin of{" "}
          <strong>{orgName}</strong> — support mode active
        </span>
      </div>
      <button
        onClick={exit}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1 bg-amber-700/20 hover:bg-amber-700/30 rounded-lg transition-colors text-xs font-semibold"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        Exit
      </button>
    </div>
  )
}
