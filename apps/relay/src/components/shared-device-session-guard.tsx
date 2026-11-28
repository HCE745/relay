"use client"

// SharedDeviceSessionGuard — session activity renewal for registered-device contexts.
//
// Active when the current session has an inactivity timeout policy (registered device
// with shared-device policy, for any authenticated user type including email/password logins).
// When inactive sessions should expire, this guard renews the session on genuine
// user activity and redirects to /login on 401 (expired or revoked).
//
// Renders nothing — purely behavioural.

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

const HEARTBEAT_DEBOUNCE_MS = 30_000

type Props = {
  enabled: boolean  // true when session.inactivityTimeoutSeconds is set
}

export function SharedDeviceSessionGuard({ enabled }: Props) {
  const router           = useRouter()
  const lastHeartbeatAt  = useRef(0)
  const pendingRef       = useRef(false)

  const sendHeartbeat = useCallback(async () => {
    if (!enabled) return
    if (pendingRef.current) return
    const now = Date.now()
    if (now - lastHeartbeatAt.current < HEARTBEAT_DEBOUNCE_MS) return

    pendingRef.current = true
    try {
      const res = await fetch("/api/auth/employee/heartbeat", { method: "POST" })
      if (res.status === 401) {
        router.replace("/login")
        return
      }
      lastHeartbeatAt.current = Date.now()
    } catch {
      // Network error — do not treat as expired; next activity will retry
    } finally {
      pendingRef.current = false
    }
  }, [enabled, router])

  useEffect(() => {
    if (!enabled) return

    const EVENTS = ["click", "touchstart", "keydown", "pointerdown"] as const
    function handleActivity() { void sendHeartbeat() }

    for (const ev of EVENTS) {
      window.addEventListener(ev, handleActivity, { passive: true, capture: true })
    }
    return () => {
      for (const ev of EVENTS) {
        window.removeEventListener(ev, handleActivity, { capture: true })
      }
    }
  }, [enabled, sendHeartbeat])

  return null
}
