"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { STEPS, type Step } from "./steps"

// Guided demo tour engine. Mounted in the admin layout, demo-only. Spotlights a
// real element per step, shows a short tooltip, persists position across
// navigation (sessionStorage). Closing (X / Skip / Escape / click outside the
// tooltip) PRESERVES the current step; "Take the tour" resumes from it, and a
// separate "Restart tour" goes back to step 1. Hand-rolled (no tour library) to
// match the app's light design and avoid a new dependency.

const SK_DISMISSED = "cln-tour-dismissed"
const SK_STEP = "cln-tour-step"
const SK_STARTED = "cln-tour-started"

function ss(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function ssSet(key: string, val: string) {
  try { sessionStorage.setItem(key, val) } catch { /* private mode */ }
}

interface Rect { top: number; left: number; width: number; height: number }

function waitForEl(selector: string, ms = 6000): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector)
    if (found) return resolve(found)
    const t0 = Date.now()
    const iv = setInterval(() => {
      const el = document.querySelector(selector)
      if (el) { clearInterval(iv); resolve(el) }
      else if (Date.now() - t0 > ms) { clearInterval(iv); resolve(null) }
    }, 100)
  })
}

const getRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

const CARD_W = 340
const CARD_H = 260
const GAP = 16
const SIDEBAR_W = 256 // md:pl-64

function cardPos(rect: Rect | null): React.CSSProperties {
  if (typeof window === "undefined") return { position: "fixed", top: GAP, left: GAP, width: CARD_W }
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!rect) {
    // Centered (no target) — middle of the viewport.
    return { position: "fixed", top: Math.max(GAP, vh / 2 - CARD_H / 2), left: Math.max(GAP, vw / 2 - CARD_W / 2), width: CARD_W }
  }
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const clampTop = (t: number) => Math.max(GAP, Math.min(t, vh - CARD_H - GAP))

  if (rect.left < SIDEBAR_W && SIDEBAR_W + GAP + CARD_W <= vw) {
    return { position: "fixed", top: clampTop(cy - CARD_H / 2), left: SIDEBAR_W + GAP, width: CARD_W }
  }
  if (cx < vw / 2 && rect.left + rect.width + GAP + CARD_W <= vw) {
    return { position: "fixed", top: clampTop(cy - CARD_H / 2), left: rect.left + rect.width + GAP, width: CARD_W }
  }
  if (cx >= vw / 2 && rect.left - GAP - CARD_W >= GAP) {
    return { position: "fixed", top: clampTop(cy - CARD_H / 2), left: rect.left - GAP - CARD_W, width: CARD_W }
  }
  const left = Math.max(GAP, Math.min(cx - CARD_W / 2, vw - CARD_W - GAP))
  return cy < vh / 2
    ? { position: "fixed", top: clampTop(rect.top + rect.height + GAP), left, width: CARD_W }
    : { position: "fixed", top: clampTop(rect.top - GAP - CARD_H), left, width: CARD_W }
}

export function ProductTour({ isDemo }: { isDemo: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [phase, setPhase] = useState<"hidden" | "active">("hidden")
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [navigating, setNavigating] = useState(false)
  // True when the tour was just reopened mid-way, so we can say "resuming".
  const [resumed, setResumed] = useState(false)

  const step: Step | undefined = STEPS[idx]
  const total = STEPS.length
  const isLast = idx === total - 1

  // Boot: auto-start on first demo entry; resume saved position otherwise.
  useEffect(() => {
    if (!isDemo || STEPS.length === 0) return
    // Never run inside an iframe — the breakage checker loads real admin pages in
    // a hidden frame, and a tour booting there would navigate the frame away.
    if (typeof window !== "undefined" && window.self !== window.top) return
    if (ss(SK_DISMISSED) === "1") return
    const savedStep = ss(SK_STEP)
    if (ss(SK_STARTED) === "1") {
      setIdx(savedStep ? Math.min(parseInt(savedStep, 10) || 0, STEPS.length - 1) : 0)
      setPhase("active")
    } else {
      ssSet(SK_STARTED, "1")
      ssSet(SK_STEP, "0")
      setIdx(0)
      setPhase("active")
    }
  }, [isDemo])

  // Two entry points: "Take the tour" RESUMES from the preserved step (or starts
  // at step 1 when nothing is saved); "Restart tour" always goes to step 1 and
  // clears the saved step.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (t.closest("[data-action='start-cln-tour']")) {
        ssSet(SK_DISMISSED, "")
        ssSet(SK_STARTED, "1")
        const saved = Math.min(parseInt(ss(SK_STEP) || "0", 10) || 0, STEPS.length - 1)
        setIdx(saved)
        setResumed(saved > 0) // show the "resuming" hint only when landing mid-tour
        setRect(null)
        setPhase("active")
      } else if (t.closest("[data-action='restart-cln-tour']")) {
        ssSet(SK_DISMISSED, "")
        ssSet(SK_STARTED, "1")
        ssSet(SK_STEP, "0")
        setIdx(0)
        setResumed(false)
        setRect(null)
        setPhase("active")
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  // Navigate to the step's page when it differs from the current one.
  useEffect(() => {
    if (phase !== "active" || !step) return
    if (pathname === step.path) { setNavigating(false); return }
    setNavigating(true)
    router.push(step.path)
  }, [phase, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step && pathname === step.path) setNavigating(false)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the spotlight rect once on the right page.
  useEffect(() => {
    setRect(null)
    if (phase !== "active" || !step || navigating || !step.selector) return
    let cancelled = false
    waitForEl(step.selector).then((el) => {
      if (cancelled || !el) return
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => { if (!cancelled) setRect(getRect(el)) }, 350)
    })
    return () => { cancelled = true }
  }, [phase, idx, navigating]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the rect synced on scroll/resize.
  useEffect(() => {
    if (!step?.selector) return
    const update = () => { const el = document.querySelector(step.selector!); if (el) setRect(getRect(el)) }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update) }
  }, [step?.selector])

  // Closing (X, Skip, Escape, or a click outside the tooltip) PRESERVES the
  // current step so "Take the tour" can resume from it. Only "Restart tour"
  // clears it. Marking DISMISSED stops it auto-reopening on navigation.
  const dismiss = useCallback(() => {
    ssSet(SK_DISMISSED, "1")
    setPhase("hidden")
    setRect(null)
  }, [])
  const go = useCallback((n: number) => { setIdx(n); ssSet(SK_STEP, String(n)); setRect(null); setResumed(false) }, [])
  const next = useCallback(() => { if (isLast) dismiss(); else go(idx + 1) }, [isLast, idx, go, dismiss])
  const prev = useCallback(() => { if (idx > 0) go(idx - 1) }, [idx, go])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && phase === "active") dismiss() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [phase, dismiss])

  if (!isDemo || phase !== "active" || !step) return null

  const showSpotlight = !!rect && !navigating
  const pos = cardPos(showSpotlight ? rect : null)

  return (
    <div className="fixed inset-0 z-[9000]" aria-live="polite" role="dialog" aria-label="Product tour" onClick={dismiss}>
      {/* Clicking the dimmed area (outside the tooltip) closes the tour but keeps the step. */}
      {/* Dimmer with a spotlight cutout over the target (box-shadow trick). */}
      {showSpotlight ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-brand-500 transition-all duration-200"
          style={{
            top: rect!.top - 6, left: rect!.left - 6, width: rect!.width + 12, height: rect!.height + 12,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-slate-900/55" />
      )}

      {/* Tooltip card — clicks inside must not close the tour. */}
      <div style={pos} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 pb-2.5 pt-3">
          <span className="shrink-0 text-xs font-medium text-slate-400">Step {idx + 1} of {total}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          <button onClick={dismiss} title="Skip tour" aria-label="Skip tour" className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="px-4 py-3.5">
          {resumed && !navigating ? <p className="mb-1.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Resuming at step {idx + 1}</p> : null}
          <h3 className="mb-1.5 text-[15px] font-bold leading-snug text-slate-900">{step.title}</h3>
          {navigating ? (
            <p className="text-sm text-slate-400">Opening the screen…</p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-4">
          <button onClick={dismiss} className="text-xs font-medium text-slate-400 hover:text-slate-600">Skip tour</button>
          <div className="flex gap-2">
            {idx > 0 ? (
              <button onClick={prev} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
            ) : null}
            <button onClick={next} className="rounded-lg bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800">
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
