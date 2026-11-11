"use client"

import { useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

function getOrCreateSessionId(): string {
  if (typeof sessionStorage === "undefined") return Math.random().toString(36).slice(2)
  let id = sessionStorage.getItem("relay_session_id")
  if (!id) {
    id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    sessionStorage.setItem("relay_session_id", id)
  }
  return id
}

function isNewSession(token: string): boolean {
  if (typeof sessionStorage === "undefined") return true
  const seen = sessionStorage.getItem("relay_seen_token")
  if (seen === token) return false
  sessionStorage.setItem("relay_seen_token", token)
  return true
}

// Module-level active-time accumulator — written by RelayTracker, read by fireTrackingEvent
// so tour_step_completed and similar events automatically carry elapsed active time.
let _moduleActiveSeconds = 0
let _moduleLastActive: number | null = null

function _flushModuleTime() {
  if (_moduleLastActive !== null) {
    _moduleActiveSeconds += (Date.now() - _moduleLastActive) / 1000
    _moduleLastActive = null
  }
}

export function getActiveSeconds(): number {
  _flushModuleTime()
  return Math.round(_moduleActiveSeconds)
}

export function fireTrackingEvent(
  eventType: string,
  eventData: Record<string, unknown> = {},
  activeTimeSeconds?: number,
) {
  const token = getCookie("relay_track")
  if (!token) return
  const sessionId = getOrCreateSessionId()
  // If caller doesn't specify, use the module-level accumulator
  const seconds = activeTimeSeconds ?? getActiveSeconds()
  fetch("/api/track/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, eventType, eventData, sessionId, activeTimeSeconds: seconds }),
  }).catch(() => {})
}

// Exported so tour-overlay can call it without needing cookie logic
export { getCookie as getTrackingToken }

export function RelayTracker() {
  const pathname  = usePathname()
  const firedRef  = useRef(new Set<string>())    // dedup page_viewed events

  const accumulate = useCallback(() => {
    _flushModuleTime()
  }, [])

  // Visibility + activity tracking
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) _moduleLastActive = Date.now()
      else _flushModuleTime()
    }
    document.addEventListener("visibilitychange", onVisible)
    // Start counting if tab is already visible
    if (!document.hidden) _moduleLastActive = Date.now()

    // Activity: reset inactivity timeout — stop counting if idle >60s
    let idleTimer: ReturnType<typeof setTimeout>
    function resetIdle() {
      clearTimeout(idleTimer)
      if (!_moduleLastActive) _moduleLastActive = Date.now()
      idleTimer = setTimeout(() => {
        _flushModuleTime()  // stop counting — user is idle
      }, 60_000)
    }
    window.addEventListener("mousemove", resetIdle, { passive: true })
    window.addEventListener("keydown",   resetIdle, { passive: true })
    window.addEventListener("scroll",    resetIdle, { passive: true })
    window.addEventListener("click",     resetIdle, { passive: true })

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("mousemove", resetIdle)
      window.removeEventListener("keydown",   resetIdle)
      window.removeEventListener("scroll",    resetIdle)
      window.removeEventListener("click",     resetIdle)
      clearTimeout(idleTimer)
      accumulate()
    }
  }, [accumulate])

  // Fire events on route change
  useEffect(() => {
    const token = getCookie("relay_track")
    if (!token) return

    const sessionId = getOrCreateSessionId()
    const newSession = isNewSession(token)

    if (newSession) {
      // First hit in this browser session — returned visit or fresh link click
      const sessionCount = parseInt(sessionStorage.getItem("relay_session_count") ?? "0") + 1
      sessionStorage.setItem("relay_session_count", String(sessionCount))
      if (sessionCount > 1) {
        fetch("/api/track/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token, sessionId,
            eventType: "returned_visit",
            eventData: { path: pathname, sessionNumber: sessionCount },
            activeTimeSeconds: 0,
          }),
        }).catch(() => {})
      }
    }

    // Pricing page detection
    if (pathname.includes("pricing") || pathname.includes("/plans")) {
      fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, sessionId, eventType: "pricing_viewed",
          eventData: { path: pathname }, activeTimeSeconds: 0,
        }),
      }).catch(() => {})
    }

    // Generic page_viewed (deduplicated per route)
    const pageKey = `${token}:${pathname}`
    if (!firedRef.current.has(pageKey)) {
      firedRef.current.add(pageKey)
      fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, sessionId, eventType: "page_viewed",
          eventData: { path: pathname }, activeTimeSeconds: 0,
        }),
      }).catch(() => {})
    }
  }, [pathname])

  return null
}
