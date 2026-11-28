"use client"

// native-scanner-bridge — connects Capacitor industrial scanner plugins to ScannerBus.
//
// Bridges the three native Capacitor scanner plugins to the shared ScannerBus singleton:
//   - ZebraDataWedge      (Zebra DataWedge intent delivery + optional auto-configuration)
//   - HoneywellScanner    (Honeywell Scan Wedge + Datalogic Intent Wedge)
//   - GenericIntentScanner (Urovo, Unitech, CipherLab, Newland, Point Mobile, Chainway, Bluebird)
//
// All three plugins emit a "scan" event with shape { value, source, labelType? }.
// This module emits each as a ScanEvent on the ScannerBus so all app contexts
// (standard login, quick-access login, badge enrollment, QR interfaces) receive
// industrial scanner input without per-screen setup.
//
// Initialization:
//   Call initNativeScannerBridge() once — idempotent, safe to call from multiple places.
//   The root app layout calls it; individual pages do NOT need to call it themselves.
//   Listener handles are retained and cleaned up on demand via cleanupNativeScannerBridge().
//
// Fallback:
//   On non-Capacitor environments (browser, desktop) the function is a no-op.
//   Keyboard-wedge and camera scanning continue to work without any native bridge.

import { scannerBus, type ScanEvent } from "@/lib/scanner-bus"

interface NativeScanEvent {
  value:      string
  source:     string
  labelType?: string
}

interface ListenerHandle {
  remove: () => void
}

let initialized     = false
let listenerHandles: ListenerHandle[] = []

export async function initNativeScannerBridge(): Promise<void> {
  if (initialized) return
  if (typeof window === "undefined") return

  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (!cap || !cap.isNativePlatform?.()) return

  try {
    const { registerPlugin } = await import("@capacitor/core")

    interface ScannerPlugin {
      addListener(event: "scan", handler: (data: NativeScanEvent) => void): Promise<ListenerHandle>
    }
    interface DataWedgePlugin extends ScannerPlugin {
      configureProfile(): Promise<{ ok?: boolean; skipped?: boolean; reason?: string }>
    }

    const ZebraDataWedge       = registerPlugin<DataWedgePlugin>("ZebraDataWedge")
    const HoneywellScanner     = registerPlugin<ScannerPlugin>("HoneywellScanner")
    const GenericIntentScanner = registerPlugin<ScannerPlugin>("GenericIntentScanner")

    function handleNativeScan(data: NativeScanEvent) {
      if (!data.value) return
      const event: ScanEvent = { value: data.value, source: "KEYBOARD_WEDGE" }
      scannerBus?.emit(event)
    }

    // Register all three plugins; store handles for later cleanup
    const handles = await Promise.all([
      ZebraDataWedge.addListener("scan", handleNativeScan),
      HoneywellScanner.addListener("scan", handleNativeScan),
      GenericIntentScanner.addListener("scan", handleNativeScan),
    ])
    listenerHandles = handles

    initialized = true
  } catch {
    // Capacitor or plugins unavailable — keyboard-wedge and camera scanning still work
  }
}

/** Remove all native listener handles. Called on unmount or app teardown. */
export function cleanupNativeScannerBridge(): void {
  for (const h of listenerHandles) {
    try { h.remove() } catch { /* ignore */ }
  }
  listenerHandles = []
  initialized = false
}
