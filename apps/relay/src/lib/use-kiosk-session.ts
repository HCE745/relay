"use client"

// useKioskSession — shared-device session manager for Quick Access kiosk screens.
//
// Behaviour:
//   - Tracks genuine employee interaction (click, touch, keypress, scroll, pointer).
//   - Sends a heartbeat to /api/auth/employee/heartbeat when genuine activity is
//     detected, subject to a debounce (at most once per HEARTBEAT_DEBOUNCE_MS).
//   - Does NOT send background keep-alive pings; heartbeat only fires after real
//     input so inactive sessions expire naturally.
//   - On 401 (session expired) calls onExpired() — the caller redirects to login.
//   - On explicit logout calls onLogout() after clearing the session cookie via API.
//   - Cleans up all listeners on unmount.
//
// The heartbeat endpoint itself caps the renewal against the hard max-session-duration
// encoded in the JWT, so the client cannot extend the session beyond that limit.

import { useEffect, useRef, useCallback } from "react"

const HEARTBEAT_DEBOUNCE_MS = 30_000  // send at most one heartbeat per 30 s of activity

type Options = {
  onExpired: () => void   // called when session expires (401 from heartbeat)
  onLogout:  () => void   // called after a successful logout
}

export function useKioskSession({ onExpired, onLogout }: Options) {
  const lastHeartbeatAt = useRef(0)
  const pendingRef      = useRef(false)

  const sendHeartbeat = useCallback(async () => {
    if (pendingRef.current) return
    const now = Date.now()
    if (now - lastHeartbeatAt.current < HEARTBEAT_DEBOUNCE_MS) return

    pendingRef.current = true
    try {
      const res = await fetch("/api/auth/employee/heartbeat", { method: "POST" })
      if (res.status === 401) {
        onExpired()
        return
      }
      lastHeartbeatAt.current = Date.now()
    } catch {
      // Network error — do not treat as expired; next activity will retry
    } finally {
      pendingRef.current = false
    }
  }, [onExpired])

  useEffect(() => {
    // Genuine interaction events — not scroll alone (which can be inertia)
    const EVENTS = ["click", "touchstart", "keydown", "pointerdown"] as const

    function handleActivity() {
      void sendHeartbeat()
    }

    for (const ev of EVENTS) {
      window.addEventListener(ev, handleActivity, { passive: true, capture: true })
    }

    return () => {
      for (const ev of EVENTS) {
        window.removeEventListener(ev, handleActivity, { capture: true })
      }
    }
  }, [sendHeartbeat])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Best-effort; continue to redirect
    }
    onLogout()
  }, [onLogout])

  return { logout }
}
