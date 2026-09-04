"use client"

import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"
import { isNativeApp } from "@/lib/capacitor"

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    if (isNativeApp()) {
      void setupCapacitorListener()
    } else {
      // Browser fallback
      const goOffline = () => setIsOffline(true)
      const goOnline  = () => setIsOffline(false)
      window.addEventListener("offline", goOffline)
      window.addEventListener("online",  goOnline)
      return () => {
        window.removeEventListener("offline", goOffline)
        window.removeEventListener("online",  goOnline)
      }
    }
  }, [])

  async function setupCapacitorListener() {
    try {
      const { Network } = await import("@capacitor/network")
      const status = await Network.getStatus()
      setIsOffline(!status.connected)
      await Network.addListener("networkStatusChange", s => setIsOffline(!s.connected))
    } catch { /* bridge not available */ }
  }

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[9999] bg-gray-900 text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Connection lost — some features may be unavailable.</span>
    </div>
  )
}
