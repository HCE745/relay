"use client"

// Kiosk dashboard — displayed after a successful Quick Access login.
//
// - Shows the authenticated employee's name.
// - Runs the shared-device session manager: heartbeats on genuine interaction only.
// - On session expiry (401) or explicit logout, returns to /kiosk/login.
//
// This is a scaffold. Additional employee-facing views (clock-in/out, tasks,
// shift info) are added in later phases.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, KeyRound, Loader2 } from "lucide-react"
import { useKioskSession } from "@/lib/use-kiosk-session"

interface KioskUserInfo {
  name:  string
  role:  string
}

export default function KioskDashboardPage() {
  const router = useRouter()
  const [user, setUser]       = useState<KioskUserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const { logout } = useKioskSession({
    onExpired: () => {
      router.replace("/kiosk/login?reason=expired")
    },
    onLogout: () => {
      router.replace("/kiosk/login")
    },
  })

  useEffect(() => {
    void fetch("/api/auth/me")
      .then(async res => {
        if (!res.ok) { router.replace("/kiosk/login"); return }
        const data = await res.json() as KioskUserInfo
        setUser(data)
        setLoading(false)
      })
      .catch(() => router.replace("/kiosk/login"))
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">Quick Access</span>
        </div>
        <button
          onClick={() => void logout()}
          className="flex items-center gap-2 px-3 py-1.5 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-600/20 border-2 border-blue-500/40 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-blue-300 select-none">
              {user?.name.charAt(0).toUpperCase() ?? "?"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome, {user?.name}
          </h1>
          <p className="text-sm text-gray-400 capitalize">{user?.role?.toLowerCase().replace("_", " ")}</p>
        </div>
      </main>
    </div>
  )
}
