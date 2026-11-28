"use client"

// SharedDeviceSessionGuard — session expiration enforcement for registered-device contexts.
//
// Active when the current session has ANY duration policy (inactivity timeout, max duration,
// or both).  Handles all four policy combinations:
//
//   1. inactivity only       — heartbeat on activity + client timer
//   2. max duration only     — client timer only (no heartbeat)
//   3. both                  — heartbeat on activity + client timer capped by hard deadline
//   4. both disabled         — guard is not enabled; this component does nothing
//
// Authoritative expiry is always server-side (JWT + cookie).  Client-side timer provides
// fast response so the user is redirected promptly rather than waiting for the next server
// round-trip.  Background polling detects administrative revocation independently of
// whether the user is active.
//
// Renders nothing — purely behavioural.

import { useEffect, useRef, useCallback } from "react"

const HEARTBEAT_DEBOUNCE_MS = 30_000   // min gap between heartbeat calls on activity
const BACKGROUND_POLL_MS    = 120_000  // poll /api/auth/me every 2 min to catch revocation

type HeartbeatResponse = {
  ok:             boolean
  extended?:      boolean
  newExpiresAtMs?: number | null
}

type Props = {
  enabled:              boolean        // true when any session policy is active
  sessionExpiresAtMs:   number | null  // JWT exp converted to milliseconds
  hasInactivityTimeout: boolean        // true when inactivityTimeoutSeconds is set
  inactivityTimeoutMs:  number | null  // fallback for timer reschedule when server omits newExpiresAtMs
}

export function SharedDeviceSessionGuard({
  enabled,
  sessionExpiresAtMs,
  hasInactivityTimeout,
  inactivityTimeoutMs,
}: Props) {
  const expiryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastHeartbeatAt  = useRef(0)
  const pendingHeartbeat = useRef(false)
  const redirectedRef    = useRef(false)

  const redirect = useCallback(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    if (expiryTimerRef.current)  clearTimeout(expiryTimerRef.current)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    // window.location.replace does a hard navigation: clears all in-memory React state,
    // the Next.js router cache, and browser history entry for the employee session.
    // router.replace() alone does not flush the Next.js App Router cache, so a subsequent
    // employee could see stale page data for a brief period.
    window.location.replace("/login")
  }, [])

  const scheduleExpiryAt = useCallback((expiresAtMs: number) => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
    const delay = Math.max(0, expiresAtMs - Date.now())
    expiryTimerRef.current = setTimeout(() => redirect(), delay)
  }, [redirect])

  const sendHeartbeat = useCallback(async () => {
    if (!enabled || !hasInactivityTimeout) return
    if (pendingHeartbeat.current) return
    if (Date.now() - lastHeartbeatAt.current < HEARTBEAT_DEBOUNCE_MS) return

    pendingHeartbeat.current = true
    try {
      const res = await fetch("/api/auth/employee/heartbeat", { method: "POST" })
      if (res.status === 401) { redirect(); return }

      lastHeartbeatAt.current = Date.now()

      if (res.ok) {
        const data = await res.json() as HeartbeatResponse
        if (data.extended) {
          // Reschedule expiry timer with the server's authoritative new deadline
          if (data.newExpiresAtMs) {
            scheduleExpiryAt(data.newExpiresAtMs)
          } else if (inactivityTimeoutMs) {
            // Fallback: optimistic estimate when server omits newExpiresAtMs
            scheduleExpiryAt(Date.now() + inactivityTimeoutMs)
          }
        }
      }
    } catch {
      // Network error — do not treat as expired; server-side check will catch revocation
    } finally {
      pendingHeartbeat.current = false
    }
  }, [enabled, hasInactivityTimeout, inactivityTimeoutMs, redirect, scheduleExpiryAt])

  // Initial expiry timer and background revocation poll
  useEffect(() => {
    if (!enabled) return

    if (sessionExpiresAtMs) {
      scheduleExpiryAt(sessionExpiresAtMs)
    }

    // Background poll — calls /api/auth/me which READS the JWT without renewing it.
    // This detects admin-initiated revocation even when the user has not been active.
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me")
        if (res.status === 401) redirect()
      } catch {
        // Network error — do not redirect; server remains authoritative
      }
    }, BACKGROUND_POLL_MS)

    return () => {
      if (expiryTimerRef.current)  clearTimeout(expiryTimerRef.current)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [enabled, sessionExpiresAtMs, scheduleExpiryAt, redirect])

  // Activity-based heartbeat — only when inactivity timeout is set.
  // On devices with max-duration-only policy this block is skipped.
  useEffect(() => {
    if (!enabled || !hasInactivityTimeout) return
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
  }, [enabled, hasInactivityTimeout, sendHeartbeat])

  return null
}
