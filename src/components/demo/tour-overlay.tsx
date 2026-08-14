"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, X, ExternalLink, Check, Lock, Volume2, VolumeX, Play, Pause } from "lucide-react"
import { useTour } from "./tour-context"
import { TOUR_STEPS, ROLE_DEMOS, INDUSTRY_DEMOS, PACKAGE_DEMOS, ADDITIONAL_FEATURES, getActiveTourSteps, getNumTourSteps } from "./tour-steps"
import { fireTrackingEvent } from "./relay-tracker"

// ── Utilities ─────────────────────────────────────────────────────────────────

function waitForElement(selector: string, timeout = 8000): Promise<Element | null> {
  return new Promise(resolve => {
    const el = document.querySelector(selector)
    if (el) { resolve(el); return }
    const start = Date.now()
    const iv = setInterval(() => {
      const found = document.querySelector(selector)
      if (found) { clearInterval(iv); resolve(found); return }
      if (Date.now() - start > timeout) { clearInterval(iv); resolve(null) }
    }, 100)
  })
}

interface Rect { top: number; left: number; width: number; height: number }

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function cardStyle(rect: Rect): React.CSSProperties {
  const pad = 16
  const cardW = 360
  const vw = window.innerWidth
  const vh = window.innerHeight
  const est = 380

  if (rect.left + rect.width + pad + cardW <= vw) {
    return { position: "fixed", top: Math.max(pad, Math.min(rect.top + rect.height / 2 - est / 2, vh - est - pad)), left: rect.left + rect.width + pad, width: cardW }
  }
  if (rect.left - pad - cardW >= 0) {
    return { position: "fixed", top: Math.max(pad, Math.min(rect.top + rect.height / 2 - est / 2, vh - est - pad)), left: rect.left - pad - cardW, width: cardW }
  }
  if (rect.top + rect.height + pad + est <= vh) {
    return { position: "fixed", top: rect.top + rect.height + pad, left: Math.max(pad, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - pad)), width: cardW }
  }
  return { position: "fixed", top: Math.max(pad, rect.top - pad - est), left: Math.max(pad, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - pad)), width: cardW }
}

function timeRemainingLabel(step: number, total: number): string | null {
  const stepsLeft = total - step
  const minsLeft = Math.ceil((stepsLeft * 7) / 60)
  if (minsLeft <= 0) return null
  return `${minsLeft} min left`
}

// ── Spotlight hook ────────────────────────────────────────────────────────────

function useSpotlightRect(selector: string | null, stepKey: string) {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    // Clear any previous spotlight immediately so the old position doesn't linger
    setRect(null)
    if (!selector) return
    let cancelled = false

    waitForElement(selector, 8000).then(el => {
      if (cancelled || !el) return
      // Scroll element to top of viewport — works with the dashboard's inner <main>
      // scrollable container, not just window. Wait 500ms for animation to land.
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      setTimeout(() => {
        if (cancelled) return
        setRect(getRect(el))
      }, 500)
    })

    return () => { cancelled = true }
  }, [selector, stepKey])

  // Keep spotlight rect in sync as the user scrolls or resizes after it appears
  useEffect(() => {
    if (!selector) return
    function update() {
      const el = document.querySelector(selector!)
      if (el) setRect(getRect(el))
    }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [selector])

  return rect
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  step, total, onTakeControl, audioDurationSec,
}: {
  step: number; total: number; onTakeControl: () => void; audioDurationSec: number | null;
}) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const startPct = ((step - 1) / Math.max(1, total - 1)) * 100
    const endPct   = (step       / Math.max(1, total - 1)) * 100

    el.style.transition = "none"
    el.style.width = `${startPct}%`

    const raf = requestAnimationFrame(() => {
      el.style.transition = audioDurationSec
        ? `width ${audioDurationSec}s linear`
        : "width 0.3s ease"
      el.style.width = `${endPct}%`
    })
    return () => cancelAnimationFrame(raf)
  }, [step, audioDurationSec, total])

  const timeLabel = timeRemainingLabel(step, total)
  return (
    <div className="px-4 pt-3 pb-2 border-b border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400 font-medium shrink-0">Step {step} of {total}</span>
        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            ref={barRef}
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${((step - 1) / Math.max(1, total - 1)) * 100}%` }}
          />
        </div>
        {timeLabel && <span className="text-xs text-gray-600 shrink-0">{timeLabel}</span>}
      </div>
      <div className="flex items-center justify-end">
        <button
          onClick={onTakeControl}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          Take Control →
        </button>
      </div>
    </div>
  )
}

// ── Cycling demos ─────────────────────────────────────────────────────────────

function RoleCycler({ cycleIndex }: { cycleIndex: number }) {
  const item = ROLE_DEMOS[cycleIndex % ROLE_DEMOS.length]
  return (
    <div className="mt-3 space-y-1.5">
      {ROLE_DEMOS.map((r, i) => (
        <div
          key={r.label}
          className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-500 ${
            i === cycleIndex % ROLE_DEMOS.length ? "bg-gray-700/80 ring-1 ring-blue-500/40" : "opacity-35"
          }`}
        >
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${r.color} text-white shrink-0 min-w-[90px] text-center`}>
            {r.label}
          </span>
          {i === cycleIndex % ROLE_DEMOS.length && (
            <p className="text-xs text-gray-300 leading-relaxed">{item.desc}</p>
          )}
        </div>
      ))}
      <p className="text-xs text-gray-600 mt-1 text-center">Switch roles anytime in the demo panel →</p>
    </div>
  )
}

function IndustryCycler({ cycleIndex }: { cycleIndex: number }) {
  const item = INDUSTRY_DEMOS[cycleIndex % INDUSTRY_DEMOS.length]
  return (
    <div className="mt-3 space-y-1.5">
      {INDUSTRY_DEMOS.map((ind, i) => (
        <div
          key={ind.label}
          className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-500 ${
            i === cycleIndex % INDUSTRY_DEMOS.length ? "bg-gray-700/80 ring-1 ring-blue-500/40" : "opacity-35"
          }`}
        >
          <span className="text-lg shrink-0 w-7 text-center">{ind.emoji}</span>
          <div>
            <p className={`text-sm font-semibold ${i === cycleIndex % INDUSTRY_DEMOS.length ? "text-white" : "text-gray-500"}`}>
              {ind.label}
            </p>
            {i === cycleIndex % INDUSTRY_DEMOS.length && (
              <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{item.desc}</p>
            )}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-600 mt-1 text-center">Change industry in the demo panel →</p>
    </div>
  )
}

function PackageCycler({ cycleIndex }: { cycleIndex: number }) {
  const pkgIndex = cycleIndex % PACKAGE_DEMOS.length
  const pkg = PACKAGE_DEMOS[pkgIndex]
  return (
    <div className="mt-3">
      <div className="bg-gray-800 rounded-xl p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${pkg.color} text-white`}>{pkg.label}</span>
          <span className="text-xs text-gray-400">{pkg.best}</span>
        </div>
        <ul className="space-y-1.5">
          {pkg.features.map(f => (
            <li key={f.text} className={`flex items-center gap-2 text-xs transition-all duration-300 ${f.included ? "text-gray-300" : "text-gray-600"}`}>
              {f.included ? (
                <Check className="w-3 h-3 text-green-400 shrink-0" />
              ) : (
                <Lock className="w-3 h-3 text-gray-700 shrink-0" />
              )}
              <span className={f.included ? "" : "line-through decoration-gray-700"}>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-1.5 mt-2">
        {PACKAGE_DEMOS.map((p, i) => (
          <div
            key={p.label}
            className={`flex-1 h-1 rounded-full transition-all duration-300 ${
              i === pkgIndex ? "bg-blue-500" : "bg-gray-700"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-2 text-center">Switch packages anytime in the demo panel →</p>
    </div>
  )
}

// ── Feature grid ──────────────────────────────────────────────────────────────

function FeatureGrid() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {ADDITIONAL_FEATURES.map(f => (
        <div key={f.title} className="bg-gray-800 rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm">{f.emoji}</span>
            <span className="text-xs font-semibold text-white">{f.title}</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  )
}

// ── Cinematic intro ───────────────────────────────────────────────────────────

function CinematicIntro({
  industry, step, onNext, onTakeControl,
}: {
  industry: string;
  step: (typeof TOUR_STEPS)[0];
  onNext: () => void;
  onTakeControl: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9000] bg-gray-950/97 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-xs text-blue-300 font-medium">Interactive Demo — Step 1 of {getNumTourSteps(industry)}</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-5 leading-tight">
          {step.getTitle(industry)}
        </h1>
        <p className="text-gray-400 text-base leading-relaxed mb-10 max-w-sm mx-auto">
          {step.getExplain(industry)}
        </p>

        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Begin Tour
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="mt-5">
          <button
            onClick={onTakeControl}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Explore on my own
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Completion overlay ────────────────────────────────────────────────────────

function CompletionOverlay({ industry, onClose }: { industry: string; onClose: () => void }) {
  const router = useRouter()
  const numSteps = getNumTourSteps(industry)
  const step = getActiveTourSteps(industry).find(s => s.id === numSteps)!
  const calendlyUrl = "https://calendly.com/getrelay"

  useEffect(() => {
    fireTrackingEvent("tour_completed", { industry })
  }, []) // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[9000] bg-gray-950/95 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-3">{step.getTitle(industry)}</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-7">{step.getExplain(industry)}</p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => { onClose(); router.push("/dashboard") }}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl text-sm transition-colors"
          >
            Continue Exploring Demo
          </button>
          <a
            href={industry === "Car Wash" ? "/register?industry=car_wash" : "/register"}
            onClick={() => fireTrackingEvent("trial_started", { source: "tour_completion" })}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            Start Free Trial — No Credit Card Required
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireTrackingEvent("demo_requested", { source: "calendly" })}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            Schedule Live Demo
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function TourOverlay() {
  const tour = useTour()
  const {
    isActive, currentStep, nextStep, prevStep, exitTour, skipTour, industry,
    submittedIssueId, firstAssetId, firstIssueId,
    setSubmittedIssueId, setFirstAssetId, setFirstIssueId,
  } = tour
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isMobile, setIsMobile] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [cycleIndex, setCycleIndex] = useState(0)
  const [formFillDone, setFormFillDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const benchmarksClickedRef = useRef(false)
  const autoSubmittedRef     = useRef(false)

  const [autoAdvance, setAutoAdvance] = useState(() => {
    if (typeof window === "undefined") return false
    // /tour entry always forces auto-advance ON — check URL before localStorage
    // so a prior session's stored "false" doesn't override the fresh-tour default
    if (new URLSearchParams(window.location.search).get("autoStartTour") === "1") return true
    const stored = localStorage.getItem("tour-auto-advance")
    return stored === "true"
  })
  const [audioEnabled, setAudioEnabled] = useState(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem("tour-audio-enabled") !== "false"
  })
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoAdvanceRef = useRef(autoAdvance)
  const audioEnabledRef = useRef(audioEnabled)
  const nextStepFnRef = useRef(nextStep)

  const prevStepRef       = useRef(currentStep)
  const trackedStartRef   = useRef(false)
  const trackedStepRef    = useRef(0)

  const step = getActiveTourSteps(industry).find(s => s.id === currentStep)

  // Resolve dynamic paths
  const resolvedPath = !step ? null
    : step.path === "SUBMITTED_ISSUE" ? (submittedIssueId ? `/issues/${submittedIssueId}` : null)
    : step.path === "FIRST_ASSET"     ? (firstAssetId    ? `/assets/${firstAssetId}`  : null)
    : step.path === "FIRST_ISSUE"     ? (firstIssueId    ? `/issues/${firstIssueId}`   : null)
    : step.path

  // Check if current location matches a resolved path (handles query params)
  function pathMatches(resolved: string): boolean {
    const qIdx = resolved.indexOf("?")
    if (qIdx === -1) return pathname === resolved
    const targetPath = resolved.slice(0, qIdx)
    if (pathname !== targetPath) return false
    const targetParams = new URLSearchParams(resolved.slice(qIdx + 1))
    for (const [k, v] of targetParams) {
      if (searchParams.get(k) !== v) return false
    }
    return true
  }

  const stepKey = `${currentStep}-${resolvedPath ?? "cur"}`

  const isFormStep = step?.type === "form-fill"

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    function check() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    if (!isActive) return
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") exitTour()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [isActive, exitTour])

  // Fire tour_started on first step
  useEffect(() => {
    if (isActive && currentStep === 1 && !trackedStartRef.current) {
      trackedStartRef.current = true
      fireTrackingEvent("tour_started", { step: 1 })
    }
  }, [isActive, currentStep])

  // Fire tour_step_completed whenever we advance past a step
  useEffect(() => {
    if (!isActive || currentStep <= 1 || currentStep === trackedStepRef.current) return
    trackedStepRef.current = currentStep
    fireTrackingEvent("tour_step_completed", { step: currentStep - 1 })
  }, [isActive, currentStep])

  // Reset per-step state when step changes
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      prevStepRef.current = currentStep
      setCycleIndex(0)
      setFormFillDone(false)
      setIsSubmitting(false)
      benchmarksClickedRef.current = false
      autoSubmittedRef.current = false
    }
  }, [currentStep])

  // Navigate to target path when step changes
  useEffect(() => {
    if (!isActive || !step) return
    if (!resolvedPath) { setIsNavigating(false); return }
    if (pathMatches(resolvedPath)) { setIsNavigating(false); return }
    setIsNavigating(true)
    router.push(resolvedPath)
  }, [currentStep, resolvedPath]) // eslint-disable-line

  // Clear navigating once path matches
  useEffect(() => {
    if (!resolvedPath || pathMatches(resolvedPath)) {
      setIsNavigating(false)
    }
  }, [pathname, searchParams, resolvedPath]) // eslint-disable-line

  // Scroll to top on each step. The dashboard layout scrolls a <main> element,
  // not the window, so window.scrollTo does nothing — target <main> directly.
  useEffect(() => {
    if (!isActive || isNavigating) return
    const main = document.querySelector("main")
    if (main) {
      main.scrollTop = 0
    } else {
      window.scrollTo({ top: 0, behavior: "instant" })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [currentStep, isActive, isNavigating])

  // Fetch first asset ID as soon as tour starts (background, before step 6)
  useEffect(() => {
    if (!isActive || firstAssetId) return
    fetch("/api/assets")
      .then(r => r.json() as Promise<{ assets?: Array<{ id: string }> } | Array<{ id: string }>>)
      .then(data => {
        const assets = Array.isArray(data) ? data : (data.assets ?? [])
        if (assets[0]?.id) setFirstAssetId(assets[0].id)
      })
      .catch(() => {})
  }, [isActive, firstAssetId]) // eslint-disable-line

  // Fetch first issue ID at tour start — used for FIRST_ISSUE path resolution (Car Wash steps 6-7)
  useEffect(() => {
    if (!isActive || firstIssueId) return
    fetch("/api/issues")
      .then(r => r.json() as Promise<Array<{ id: string }>>)
      .then(data => {
        const issues = Array.isArray(data) ? data : []
        if (issues[0]?.id) setFirstIssueId(issues[0].id)
      })
      .catch(() => {})
  }, [isActive, firstIssueId]) // eslint-disable-line

  // Auto-fill form on form-fill step
  useEffect(() => {
    if (!isActive || step?.type !== "form-fill" || formFillDone || isNavigating) return
    if (pathname !== "/issues/new") return

    let cancelled = false

    async function doFill() {
      if (cancelled) return

      const formData = step?.getFormData?.(industry)
      if (!formData) return

      // Wait for the form to actually render in the DOM (up to 8s).
      // Next.js App Router updates `pathname` before the page tree mounts,
      // so a fixed 600ms delay races against React rendering — use polling instead.
      const titleEl = await waitForElement("input[name='title']", 8000) as HTMLInputElement | null
      if (cancelled) return
      if (!titleEl) {
        // Form never appeared — still mark done so "Submit Issue" button shows
        setFormFillDone(true)
        return
      }

      await new Promise(r => setTimeout(r, 200))
      if (cancelled) return

      // Set category first so routing rules fire with correct category
      if (formData.category) {
        const categoryEl = document.querySelector<HTMLSelectElement>("[data-tour='category-select']")
        if (categoryEl) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set
          setter?.call(categoryEl, formData.category)
          categoryEl.dispatchEvent(new Event("change", { bubbles: true }))
          await new Promise(r => setTimeout(r, 200))
          if (cancelled) return
        }
      }

      titleEl.focus()
      await new Promise(r => setTimeout(r, 150))
      if (cancelled) return
      titleEl.value = formData.title
      titleEl.dispatchEvent(new Event("input",  { bubbles: true }))
      titleEl.dispatchEvent(new Event("change", { bubbles: true }))

      await new Promise(r => setTimeout(r, 350))
      if (cancelled) return

      const descEl = document.querySelector<HTMLTextAreaElement>("textarea[name='description']")
      if (descEl) {
        descEl.focus()
        await new Promise(r => setTimeout(r, 150))
        if (cancelled) return
        descEl.value = formData.description
        descEl.dispatchEvent(new Event("input",  { bubbles: true }))
        descEl.dispatchEvent(new Event("change", { bubbles: true }))
      }

      if (!cancelled) setFormFillDone(true)
    }

    void doFill()
    return () => { cancelled = true }
  }, [currentStep, isActive, formFillDone, isNavigating, pathname, industry]) // eslint-disable-line

  // Auto-submit after form is filled — delay matches audio duration so the narration
  // finishes before advancing. Falls back to 8s when no audio duration is available.
  // Only fires when auto-advance is ON; manual mode shows "Submit Issue" button.
  useEffect(() => {
    if (!isActive || step?.type !== "form-fill" || !formFillDone || isSubmitting || autoSubmittedRef.current) return
    if (!autoAdvance) return
    // audioDurationSec is already set by the time formFillDone fires (~1s into playback),
    // so use the full duration — the extra ~1s of overlap is fine.
    const delay = audioDurationSec !== null ? audioDurationSec * 1000 : 8000
    const t = setTimeout(() => {
      autoSubmittedRef.current = true
      void handleTourSubmit()
    }, delay)
    return () => clearTimeout(t)
  }, [formFillDone, isActive, step?.type, isSubmitting, audioDurationSec, autoAdvance]) // eslint-disable-line

  // Auto-click benchmarks tab on the auto-click-benchmarks step
  useEffect(() => {
    if (!isActive || step?.type !== "auto-click-benchmarks" || isNavigating || benchmarksClickedRef.current) return
    if (pathname !== "/analytics") return

    let cancelled = false
    async function clickBenchmarks() {
      await new Promise(r => setTimeout(r, 800))
      if (cancelled) return
      const buttons = document.querySelectorAll<HTMLButtonElement>("button")
      for (const btn of buttons) {
        if (btn.textContent?.trim().toLowerCase() === "benchmarks") {
          btn.click()
          benchmarksClickedRef.current = true
          break
        }
      }
    }
    void clickBenchmarks()
    return () => { cancelled = true }
  }, [currentStep, isActive, isNavigating, pathname])

  // Cycling effect for cycling-type steps
  useEffect(() => {
    if (!isActive) return
    const type = step?.type
    if (type !== "cycling-roles" && type !== "cycling-industries" && type !== "cycling-packages") return

    const max = type === "cycling-roles" ? ROLE_DEMOS.length
      : type === "cycling-industries" ? INDUSTRY_DEMOS.length
      : PACKAGE_DEMOS.length

    const iv = setInterval(() => {
      setCycleIndex(i => (i + 1) % max)
    }, 1800)
    return () => clearInterval(iv)
  }, [currentStep, isActive, step?.type])

  // Keep refs in sync with latest values (avoid stale closures in audio callbacks)
  useEffect(() => { autoAdvanceRef.current = autoAdvance }, [autoAdvance])
  useEffect(() => { audioEnabledRef.current = audioEnabled }, [audioEnabled])
  useEffect(() => { nextStepFnRef.current = nextStep }, [nextStep])

  // Persist toggle preferences
  useEffect(() => { localStorage.setItem("tour-auto-advance", String(autoAdvance)) }, [autoAdvance])
  useEffect(() => { localStorage.setItem("tour-audio-enabled", String(audioEnabled)) }, [audioEnabled])

  // Mute/unmute current audio when audio toggle changes
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !audioEnabled
  }, [audioEnabled])

  // Auto-advance — React dep system manages the timer; no manual aborted/timerRef needed.
  // When audioDurationSec is known, uses precise timing; otherwise 8s fallback.
  // Cancelled automatically whenever step, navigation, toggle, or duration changes.
  useEffect(() => {
    if (!isActive || !autoAdvance || isNavigating || !step) return
    const type = step.type
    if (type === "cinematic" || type === "form-fill" || type === "completion") return
    const delay = audioDurationSec !== null ? audioDurationSec * 1000 + 300 : 8000
    console.log(`[tour] advance timer: step=${currentStep} delay=${delay}ms audioDuration=${audioDurationSec} autoAdvance=${autoAdvance}`)
    const t = setTimeout(() => {
      console.log(`[tour] advancing from step ${currentStep}`)
      nextStep()
    }, delay)
    return () => clearTimeout(t)
  }, [currentStep, isNavigating, isActive, autoAdvance, audioDurationSec, step?.type, nextStep])

  // Audio playback only — advancement is handled by the effect above
  useEffect(() => {
    if (!isActive || isNavigating || !step) return
    if (step.type === "completion") return

    let localAudio: HTMLAudioElement | null = null
    setAudioDurationSec(null)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null }

    if (!audioEnabled) return
    if (step?.audioFile === null) return  // audio explicitly disabled for this step

    const stepNum = String(currentStep).padStart(2, "0")
    const src = step?.audioFile ?? `/demo-audio/step-${stepNum}.mp3`
    console.log(`[tour] loading audio ${src}`)
    localAudio = new Audio(src)
    audioRef.current = localAudio

    localAudio.addEventListener("loadedmetadata", () => {
      if (!localAudio) return
      const dur = localAudio.duration
      if (isFinite(dur) && dur > 0) {
        console.log(`[tour] step ${currentStep} audio duration=${dur.toFixed(2)}s`)
        setAudioDurationSec(dur)
      }
    })
    localAudio.addEventListener("error", () => {
      console.warn(`[tour] step ${currentStep} audio failed — advance timer using 8s fallback`)
    })
    localAudio.play().catch(() => {
      console.warn(`[tour] step ${currentStep} autoplay blocked — advance timer using 8s fallback`)
    })

    return () => {
      if (localAudio) { localAudio.pause(); localAudio.src = "" }
      if (audioRef.current === localAudio) audioRef.current = null
      setAudioDurationSec(null)
    }
  }, [currentStep, isNavigating, isActive, audioEnabled])

  // Submit the demo issue; advance step immediately, let navigate effect handle routing
  async function handleTourSubmit() {
    if (isSubmitting) return
    const formData = step?.getFormData?.(industry)
    if (!formData) return

    setIsSubmitting(true)
    nextStep() // advance to next step immediately — don't wait for API or navigation
    try {
      const res = await fetch("/api/demo/tour-submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: formData.title, description: formData.description }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        console.error("Tour submit failed:", err.error ?? res.status)
        setIsSubmitting(false)
        return
      }
      const { issueId } = await res.json() as { issueId: string }
      setSubmittedIssueId(issueId) // triggers navigate effect → router.push to issue detail
      setIsSubmitting(false)
    } catch {
      setIsSubmitting(false)
    }
  }

  const handleNext = useCallback(async () => {
    if (step?.type === "form-fill") {
      await handleTourSubmit()
      return
    }
    nextStep()
  }, [nextStep, step?.type, industry]) // eslint-disable-line

  const rect = useSpotlightRect(
    isNavigating ? null : (step?.targetSelector ?? null),
    stepKey
  )

  if (!isActive || !step) return null

  // Full-screen cinematic intro
  if (step.type === "cinematic") {
    return (
      <CinematicIntro
        industry={industry}
        step={step}
        onNext={() => void handleNext()}
        onTakeControl={exitTour}
      />
    )
  }

  // Full-screen completion
  if (step.type === "completion") {
    return <CompletionOverlay industry={industry} onClose={skipTour} />
  }

  const showNextAsSubmit = isFormStep && formFillDone && !isSubmitting
  const showSubmitting   = isFormStep && isSubmitting

  const cardInner = (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <ProgressBar
        step={currentStep}
        total={getNumTourSteps(industry)}
        onTakeControl={exitTour}
        audioDurationSec={audioDurationSec}
      />

      <div className="px-4 py-4 flex-1 overflow-y-auto max-h-[55vh] md:max-h-none">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-white leading-snug">{step.getTitle(industry)}</h3>
          <button
            onClick={exitTour}
            className="text-gray-600 hover:text-gray-300 transition-colors p-0.5 shrink-0 mt-0.5"
            title="Exit tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isNavigating ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
            <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Navigating…
          </div>
        ) : (
          <>
            {(step.getCue || step.cue) && (
              <p className="text-xs text-gray-500 italic mb-2 leading-relaxed">
                {step.getCue ? step.getCue(industry) : step.cue}
              </p>
            )}
            <p className="text-gray-400 text-sm leading-relaxed">{step.getExplain(industry)}</p>

            {step.type === "cycling-roles"      && <RoleCycler     cycleIndex={cycleIndex} />}
            {step.type === "cycling-industries" && <IndustryCycler cycleIndex={cycleIndex} />}
            {step.type === "cycling-packages"   && <PackageCycler  cycleIndex={cycleIndex} />}
            {step.type === "feature-grid"       && <FeatureGrid />}

            {isFormStep && !formFillDone && (
              <div className="mt-3 flex items-center gap-2 text-xs text-blue-400 bg-blue-900/20 px-3 py-2 rounded-lg">
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Pre-filling the form…
              </div>
            )}
            {isFormStep && formFillDone && !isSubmitting && (
              <div className="mt-3 text-xs text-green-400 bg-green-900/20 px-3 py-2 rounded-lg">
                Form pre-filled — click "Submit Issue" to watch it go live.
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-800 flex items-center gap-1.5">
        {/* Auto-advance toggle */}
        <button
          onClick={() => setAutoAdvance(v => !v)}
          title={autoAdvance ? "Auto-advance ON" : "Auto-advance OFF"}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            autoAdvance
              ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-400"
          }`}
        >
          {autoAdvance ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          Auto
        </button>

        {/* Audio toggle */}
        <button
          onClick={() => setAudioEnabled(v => !v)}
          title={audioEnabled ? "Audio ON" : "Audio OFF"}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            audioEnabled
              ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
              : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-400"
          }`}
        >
          {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={prevStep}
          disabled={currentStep === 1 || isNavigating}
          className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 text-sm rounded-xl transition-colors min-h-[40px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex-1" />

        {showSubmitting ? (
          <button disabled className="flex items-center gap-2 px-4 py-2 bg-blue-600 opacity-70 text-white text-sm font-medium rounded-xl min-h-[40px]">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting…
          </button>
        ) : showNextAsSubmit ? (
          <button
            onClick={() => void handleNext()}
            className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors min-h-[40px]"
          >
            Submit Issue
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => void handleNext()}
            disabled={isNavigating}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors min-h-[40px]"
          >
            {currentStep === getNumTourSteps(industry) - 1 ? "Finish" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {rect ? (
        <div
          className="fixed pointer-events-none z-[9000]"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45), 0 0 0 2px rgba(59,130,246,0.7)",
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[9000] bg-black/40 pointer-events-none" />
      )}

      <div className="fixed inset-0 z-[8999]" onClick={exitTour} title="Exit tour" />

      {isMobile ? (
        <div className="fixed bottom-0 left-0 right-0 z-[9001]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {cardInner}
        </div>
      ) : (
        <div
          className="fixed z-[9001]"
          style={{
            ...(rect ? cardStyle(rect) : { bottom: "1rem", right: "1rem", width: 360 }),
            transition: "top 0.25s ease, left 0.25s ease, bottom 0.25s ease, right 0.25s ease",
          }}
        >
          {cardInner}
        </div>
      )}
    </>
  )
}
