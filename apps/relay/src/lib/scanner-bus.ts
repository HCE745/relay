// ScannerBus — central event bus for all credential scanning inputs.
//
// Three scanner input modes:
//   WEDGE_AUTO    — global keydown listener, timing-based detection (HID/USB/BT wedge)
//   FOCUSED_FIELD — dedicated <input> element; scanner output fills it, Enter submits
//   BOTH          — focused field primary, wedge fallback when no field has focus
//
// Keyboard-wedge detection (WEDGE_AUTO / BOTH):
//   HID scanners emulate a keyboard and send characters rapidly (< intervalMs
//   between keystrokes), terminated by Enter or carriage-return.
//   Configurable prefix/suffix stripping, minimum length, and timing threshold.
//
// Limitations:
//   - Timing-based detection can mis-fire on fast typists or under CPU load.
//   - Bluetooth scanners with high latency may exceed the default 30 ms threshold.
//   - If timing is unreliable, switch to FOCUSED_FIELD mode and use useScannerField().
//   - On Android WebView, keyboard-wedge scanner output is indistinguishable from typing
//     unless the scanner is configured to use a prefix/suffix or the field is focused.
//
// Scanners must NOT auto-navigate to URLs embedded in credential values.
// Never interpret arbitrary typing as scanner input — only use the wedge detector
// or explicit camera/manual calls.

export type ScanEvent = {
  value:  string
  source: "KEYBOARD_WEDGE" | "CAMERA" | "MANUAL" | "FOCUSED_FIELD"
}

export type ScanHandler = (event: ScanEvent) => boolean | void  // return true to stop propagation

export type ScannerMode = "WEDGE_AUTO" | "FOCUSED_FIELD" | "BOTH"

export interface ScannerConfig {
  /** Detection mode. Default: WEDGE_AUTO. */
  mode:        ScannerMode
  /** Max milliseconds between consecutive wedge keystrokes. Default: 30. */
  intervalMs:  number
  /** Minimum character count for a wedge burst to be treated as a scan. Default: 4. */
  minLength:   number
  /** Prefix to strip from wedge scan values. Default: "". */
  prefix:      string
  /** Suffix to strip from wedge scan values. Default: "". */
  suffix:      string
}

const DEFAULT_CONFIG: ScannerConfig = {
  mode:       "WEDGE_AUTO",
  intervalMs: 30,
  minLength:  4,
  prefix:     "",
  suffix:     "",
}

// Global configuration — updated at runtime
let config: ScannerConfig = { ...DEFAULT_CONFIG }

export function configureScannerBus(opts: Partial<ScannerConfig>) {
  config = { ...config, ...opts }
}

/** @deprecated Use configureScannerBus({ prefix, suffix }) */
export function configureWedge(opts: { prefix?: string; suffix?: string }) {
  if (opts.prefix !== undefined) config.prefix = opts.prefix
  if (opts.suffix !== undefined) config.suffix = opts.suffix
}

// ── ScannerBus class ────────────────────────────────────────────────────────

class ScannerBus {
  private handlers:  ScanHandler[] = []
  private buffer:    string        = ""
  private lastKeyAt: number        = 0
  private listening  = false

  // ── Handler registration ──────────────────────────────────────────────────

  register(handler: ScanHandler): () => void {
    this.handlers.push(handler)
    if (!this.listening && typeof window !== "undefined") this.startListening()
    return () => { this.handlers = this.handlers.filter(h => h !== handler) }
  }

  // ── Emit ──────────────────────────────────────────────────────────────────

  emit(event: ScanEvent) {
    let value = event.value

    // Strip prefix/suffix from wedge and focused-field scans
    if (event.source === "KEYBOARD_WEDGE" || event.source === "FOCUSED_FIELD") {
      if (config.prefix && value.startsWith(config.prefix)) value = value.slice(config.prefix.length)
      if (config.suffix && value.endsWith(config.suffix))   value = value.slice(0, -config.suffix.length)
    }
    if (!value) return

    for (const h of [...this.handlers].reverse()) {   // most-recently-registered first
      const stop = h({ ...event, value })
      if (stop === true) break
    }
  }

  // ── Keyboard-wedge detection ──────────────────────────────────────────────

  private startListening() {
    if (typeof window === "undefined") return
    this.listening = true
    window.addEventListener("keydown", this.onKeyDown, { capture: true })
  }

  stopListening() {
    if (typeof window === "undefined") return
    window.removeEventListener("keydown", this.onKeyDown, { capture: true })
    this.listening = false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Skip wedge detection when mode is FOCUSED_FIELD
    if (config.mode === "FOCUSED_FIELD") return

    // In BOTH mode, skip wedge detection when a focused scanner field is active
    if (config.mode === "BOTH" && e.target instanceof HTMLInputElement
        && (e.target as HTMLInputElement).dataset.scannerField === "true") return

    // Ignore modifier-key combos (Ctrl+C etc.) and special keys except Enter/CR
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const now = Date.now()

    // Enter or carriage-return terminates a possible wedge sequence
    if (e.key === "Enter" || e.key === "Return") {
      const elapsed = now - this.lastKeyAt
      const buf = this.buffer

      this.buffer    = ""
      this.lastKeyAt = 0

      if (buf.length >= config.minLength && elapsed < config.intervalMs * 3) {
        e.stopPropagation()
        e.preventDefault()
        this.emit({ value: buf, source: "KEYBOARD_WEDGE" })
      }
      return
    }

    // Only accumulate printable single characters
    if (e.key.length !== 1) {
      // Non-printable key — reset buffer
      this.buffer    = ""
      this.lastKeyAt = 0
      return
    }

    const interval = now - this.lastKeyAt
    this.lastKeyAt = now

    if (this.buffer.length === 0 || interval < config.intervalMs) {
      this.buffer += e.key
    } else {
      // Gap too large — normal typing; reset and start fresh
      this.buffer = e.key
    }
  }
}

// Singleton — shared across the whole app
export const scannerBus = typeof window !== "undefined" ? new ScannerBus() : null!

// ── useScannerField hook ──────────────────────────────────────────────────────
//
// Returns a ref to attach to a dedicated <input> element.
// The input acts as the scanner's focused field: scanner output fills it and
// Enter/CR triggers onScan. No timing heuristics — any input ending in Enter
// is treated as a scan, so the input should not be used for free-form typing.
//
// Usage:
//   const fieldRef = useScannerField((value) => handleScan(value))
//   <input ref={fieldRef} data-scanner-field="true" ... />
//
// When the field is visible, keep it focused or provide a "Re-focus scanner"
// button that calls fieldRef.current?.focus().

import { useRef, useEffect } from "react"

export function useScannerField(
  onScan: (value: string) => void,
  opts?: { autoFocus?: boolean }
) {
  const ref     = useRef<HTMLInputElement>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan   // keep current without re-registering

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (opts?.autoFocus) el.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== "Return") return

      const value = el!.value.trim()
      if (!value) return

      e.preventDefault()
      e.stopPropagation()

      // Clear the field first so the handler can refocus cleanly
      el!.value = ""

      let stripped = value
      if (config.prefix && stripped.startsWith(config.prefix)) stripped = stripped.slice(config.prefix.length)
      if (config.suffix && stripped.endsWith(config.suffix))   stripped = stripped.slice(0, -config.suffix.length)
      if (!stripped) return

      // Emit on the bus so global handlers also receive it
      scannerBus?.emit({ value: stripped, source: "FOCUSED_FIELD" })
      onScanRef.current(stripped)
    }

    el.addEventListener("keydown", handleKeyDown)
    return () => el.removeEventListener("keydown", handleKeyDown)
  }, [opts?.autoFocus])  // eslint-disable-line react-hooks/exhaustive-deps

  return ref
}
