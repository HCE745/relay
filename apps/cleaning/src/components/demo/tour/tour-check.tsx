"use client"

import { useEffect, useRef, useState } from "react"
import { STEPS, type Step } from "./steps"

// Developer breakage walk for the demo tour (/demo/tour?check=1). Loads every
// step's page in a same-origin iframe and reports, per step: whether the target
// element exists, whether the page errored or rendered empty, its HTTP status,
// and any console errors / failed fetches observed during a settle window.
// Field-app steps (phone-only, unreachable as an owner) are reported as SKIP.
//
// Honest limits: console/network capture hooks the iframe on load, so it catches
// hydration-time and client errors (the common breakage) but not errors thrown
// before load. HTTP status + redirect are caught independently via a top fetch.

type Verdict = "pass" | "fail" | "skip"
type StepResult = { idx: number; title: string; path: string; selector: string | null; verdict: Verdict; notes: string[] }

const SETTLE_MS = 1500
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function httpProbe(path: string): Promise<{ status: number; redirected: boolean; error?: string }> {
  try {
    const res = await fetch(path, { redirect: "manual", headers: { "x-tour-check": "1" } })
    const redirected = res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)
    return { status: res.status, redirected }
  } catch (e) {
    return { status: 0, redirected: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function loadInFrame(frame: HTMLIFrameElement, path: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    frame.onload = done
    frame.src = path
    setTimeout(done, 8000) // safety: never hang the walk
  })
}

async function checkStep(step: Step, idx: number, frame: HTMLIFrameElement): Promise<StepResult> {
  const notes: string[] = []
  const consoleErrors: string[] = []
  const netFailures: string[] = []

  // Field-app steps live on the phone and redirect an owner away — skip, don't fail.
  if (step.field) {
    return { idx, title: step.title, path: step.path, selector: step.selector, verdict: "skip", notes: ["field app (phone) — not reachable in an owner session; shown as a centered explainer in the tour"] }
  }

  const probe = await httpProbe(step.path)
  if (probe.error) notes.push(`document fetch failed: ${probe.error}`)
  else if (probe.status >= 500) notes.push(`server error (HTTP ${probe.status})`)

  await loadInFrame(frame, step.path)

  // Hook the iframe for console + network during the settle window.
  const win = frame.contentWindow as (Window & typeof globalThis) | null
  const doc = frame.contentDocument
  if (win) {
    const origErr = win.console.error
    win.console.error = (...args: unknown[]) => { consoleErrors.push(args.map(String).join(" ").slice(0, 200)); origErr.apply(win.console, args as []) }
    win.addEventListener("error", (e) => consoleErrors.push(`window error: ${e.message}`))
    win.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => consoleErrors.push(`unhandled rejection: ${String(e.reason).slice(0, 160)}`))
    const origFetch = win.fetch
    win.fetch = async (...a: Parameters<typeof fetch>) => {
      try {
        const r = await origFetch(...a)
        if (!r.ok) netFailures.push(`${r.status} ${typeof a[0] === "string" ? a[0] : "(request)"}`)
        return r
      } catch (err) {
        netFailures.push(`threw ${typeof a[0] === "string" ? a[0] : "(request)"}`)
        throw err
      }
    }
  }
  await sleep(SETTLE_MS)

  const finalPath = (() => { try { return frame.contentWindow?.location.pathname ?? step.path } catch { return step.path } })()
  const redirectedAway = finalPath !== step.path

  // Field app: an owner can't enter it; a redirect away is expected → SKIP.
  if (step.field && (redirectedAway || probe.redirected)) {
    notes.push(`field app (phone) — not reachable as owner; shown as an explainer in the tour`)
    return { idx, title: step.title, path: step.path, selector: step.selector, verdict: "skip", notes }
  }

  if (probe.redirected || redirectedAway) notes.push(`redirected away (final: ${finalPath})`)

  // Empty / error-boundary detection.
  const main = doc?.querySelector("main") ?? doc?.body ?? null
  const text = (main?.textContent ?? "").trim()
  const bodyHtml = (doc?.body?.innerHTML ?? "").toLowerCase()
  if (!doc) notes.push("no document in frame")
  else if (text.length < 20) notes.push(`page rendered empty (visible text ${text.length} chars)`)
  if (/application error|something went wrong|unhandled runtime error/.test(bodyHtml)) notes.push("error boundary visible on page")

  // Target element existence.
  let targetOk = true
  if (step.selector) {
    const el = doc?.querySelector(step.selector) ?? null
    targetOk = !!el
    if (!el) notes.push(`target not found: ${step.selector}`)
  }

  for (const c of consoleErrors.slice(0, 5)) notes.push(`console: ${c}`)
  for (const n of netFailures.slice(0, 5)) notes.push(`network: ${n}`)

  const hardFail =
    !!probe.error || probe.status >= 500 ||
    (!step.field && (probe.redirected || redirectedAway)) ||
    text.length < 20 || /application error|something went wrong|unhandled runtime error/.test(bodyHtml) ||
    !targetOk || consoleErrors.length > 0 || netFailures.length > 0

  return { idx, title: step.title, path: step.path, selector: step.selector, verdict: hardFail ? "fail" : "pass", notes }
}

export function TourCheck() {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [results, setResults] = useState<StepResult[]>([])
  const [running, setRunning] = useState(true)
  const [current, setCurrent] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      const frame = frameRef.current
      if (!frame) return
      const acc: StepResult[] = []
      for (let i = 0; i < STEPS.length; i++) {
        setCurrent(i)
        const r = await checkStep(STEPS[i], i, frame)
        acc.push(r)
        setResults([...acc])
      }
      setRunning(false)
    })()
  }, [])

  const pass = results.filter((r) => r.verdict === "pass").length
  const fail = results.filter((r) => r.verdict === "fail").length
  const skip = results.filter((r) => r.verdict === "skip").length
  const badge = (v: Verdict) => v === "pass" ? "bg-emerald-100 text-emerald-700" : v === "fail" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Tour breakage check</h1>
      <p className="mt-1 text-sm text-slate-500">
        Walks every tour step in a background frame and verifies the page renders, the target exists, and no console/network errors fire.
      </p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        {running ? (
          <span className="text-slate-600">Checking step {current + 1} of {STEPS.length}…</span>
        ) : (
          <span className="font-semibold text-slate-800">Done — <span className="text-emerald-700">{pass} pass</span> · <span className="text-red-700">{fail} fail</span> · <span className="text-slate-600">{skip} skip</span></span>
        )}
      </div>

      <ul className="mt-4 space-y-1.5">
        {results.map((r) => (
          <li key={r.idx} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${badge(r.verdict)}`}>{r.verdict}</span>
              <span className="font-medium text-slate-800">{r.idx + 1}. {r.title}</span>
              <code className="ml-auto text-xs text-slate-400">{r.path}</code>
            </div>
            {r.notes.length ? (
              <ul className="mt-1 pl-1 text-xs text-slate-500">{r.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
            ) : null}
          </li>
        ))}
      </ul>

      {/* data-tour-check-complete lets an automated runner wait for the walk to finish. */}
      {!running ? <div data-tour-check-complete data-pass={pass} data-fail={fail} data-skip={skip} className="sr-only" /> : null}

      {/* Hidden walker frame, sized desktop so the sidebar + all anchors render. */}
      <iframe ref={frameRef} title="tour-check" width={1280} height={900} className="pointer-events-none fixed -left-[3000px] top-0 h-[900px] w-[1280px] opacity-0" />
    </div>
  )
}
