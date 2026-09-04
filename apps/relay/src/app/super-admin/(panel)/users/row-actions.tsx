"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface Props {
  id: string
  isActive: boolean
  isSelf: boolean
}

export function SuperAdminRowActions({ id, isActive, isSelf }: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch(`/api/super-admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    })
    setLoading(false)
    router.refresh()
  }

  if (isSelf) return <span className="text-gray-600 text-xs">—</span>

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
        isActive
          ? "bg-red-950/60 hover:bg-red-900/60 text-red-400"
          : "bg-green-950/60 hover:bg-green-900/60 text-green-400"
      } disabled:opacity-50`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
      {isActive ? "Disable" : "Enable"}
    </button>
  )
}
