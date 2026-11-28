// ScannerBus — central event bus for all credential scanning inputs.
//
// Supports:
//   - Hardware keyboard-wedge scanners (USB/Bluetooth HID, Android keyboard-wedge)
//   - Camera scanner events (emitted by CameraScanner component)
//   - Manual entry (direct calls to emit())
//
// Keyboard-wedge detection:
//   HID scanners emulate a keyboard and send characters rapidly (< WEDGE_CHAR_INTERVAL_MS
//   between keystrokes), terminated by Enter. Normal typing is slower.
//   Detection also supports configurable prefix/suffix stripping.
//
// Context management:
//   Handlers are registered per-context (component mount). Remove them on unmount.
//   Only one context typically handles a scan; the bus stops propagation on first return true.
//
// Scanners must NOT auto-navigate to URLs embedded in credential values.
// Never interpret arbitrary typing as scanner input — only use the wedge detector
// or explicit camera/manual calls.

export type ScanEvent = {
  value: string
  source: "KEYBOARD_WEDGE" | "CAMERA" | "MANUAL"
}

export type ScanHandler = (event: ScanEvent) => boolean | void  // return true to stop propagation

const WEDGE_CHAR_INTERVAL_MS = 30   // keystrokes faster than this are likely a scanner
const WEDGE_MIN_LENGTH       = 4    // ignore very short bursts

// Global scanner configuration (can be updated at runtime)
let wedgePrefix = ""
let wedgeSuffix = ""

export function configureWedge(opts: { prefix?: string; suffix?: string }) {
  if (opts.prefix !== undefined) wedgePrefix = opts.prefix
  if (opts.suffix !== undefined) wedgeSuffix = opts.suffix
}

class ScannerBus {
  private handlers:   ScanHandler[] = []
  private buffer:     string        = ""
  private lastKeyAt:  number        = 0
  private listening   = false

  // ── Handler registration ────────────────────────────────────────────────────

  register(handler: ScanHandler): () => void {
    this.handlers.push(handler)
    if (!this.listening) this.startListening()
    return () => { this.handlers = this.handlers.filter(h => h !== handler) }
  }

  // ── Emit ────────────────────────────────────────────────────────────────────

  emit(event: ScanEvent) {
    // Strip prefix/suffix from wedge scans
    let value = event.value
    if (event.source === "KEYBOARD_WEDGE") {
      if (wedgePrefix && value.startsWith(wedgePrefix)) value = value.slice(wedgePrefix.length)
      if (wedgeSuffix && value.endsWith(wedgeSuffix))   value = value.slice(0, -wedgeSuffix.length)
    }
    if (!value) return

    for (const h of [...this.handlers].reverse()) {   // most-recently-registered first
      const stop = h({ ...event, value })
      if (stop === true) break
    }
  }

  // ── Keyboard-wedge detection ─────────────────────────────────────────────────

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
    // Ignore modifier-key combos (Ctrl+C etc.) and special keys except Enter
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const now = Date.now()

    // Enter terminates a possible wedge sequence
    if (e.key === "Enter") {
      const elapsed = now - this.lastKeyAt
      const buf = this.buffer

      // Reset buffer regardless
      this.buffer  = ""
      this.lastKeyAt = 0

      if (buf.length >= WEDGE_MIN_LENGTH && elapsed < WEDGE_CHAR_INTERVAL_MS * 3) {
        // Looks like a completed scanner burst — emit
        e.stopPropagation()
        e.preventDefault()
        this.emit({ value: buf, source: "KEYBOARD_WEDGE" })
      }
      return
    }

    // Only accumulate printable single characters
    if (e.key.length !== 1) {
      // Non-printable key (Escape, Tab, Arrow, etc.) — reset buffer
      this.buffer = ""
      this.lastKeyAt = 0
      return
    }

    const interval = now - this.lastKeyAt
    this.lastKeyAt = now

    if (this.buffer.length === 0 || interval < WEDGE_CHAR_INTERVAL_MS) {
      // Within scanner speed — accumulate
      this.buffer += e.key
    } else {
      // Gap too large — this is normal typing; reset and start fresh
      this.buffer  = e.key
    }
  }
}

// Singleton — shared across the whole app
export const scannerBus = typeof window !== "undefined" ? new ScannerBus() : null!
