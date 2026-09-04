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

export function fireTrackingEvent(
  eventType: string,
  eventData: Record<string, unknown> = {},
  activeTimeSeconds = 0,
) {
  const token = getCookie("relay_track")
  if (!token) return
  const sessionId = getOrCreateSessionId()
  fetch("/api/track/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, eventType, eventData, sessionId, activeTimeSeconds }),
  }).catch(() => {})
}

// Exported so tour-overlay can call it without needing cookie logic
export { getCookie as getTrackingToken }

export function RelayTracker() {
  const pathname  = usePathname()
  const activeRef = useRef(0)       // accumulated active seconds this session
  const lastRef   = useRef<number | null>(null)  // timestamp when tab became visible+active
  const firedRef  = useRef(new Set<string>())    // dedup page_viewed events

  const accumulate = useCallback(() => {
    if (lastRef.current !== null) {
      activeRef.current += (Date.now() - lastRef.current) / 1000
      lastRef.current = null
    }
  }, [])

  // Visibility + activity tracking
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) lastRef.current = Date.now()
      else accumulate()
    }
    document.addEventListener("visibilitychange", onVisible)
    // Start counting if tab is already visible
    if (!document.hidden) lastRef.current = Date.now()

    // Activity: reset inactivity timeout — stop counting if idle >60s
    let idleTimer: ReturnType<typeof setTimeout>
    function resetIdle() {
      clearTimeout(idleTimer)
      if (!lastRef.current) lastRef.current = Date.now()
      idleTimer = setTimeout(() => {
        accumulate()  // stop counting — user is idle
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
