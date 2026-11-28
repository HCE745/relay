"use client"

// native-scanner-bridge — connects Capacitor industrial scanner plugins to ScannerBus.
//
// On Android, registers listeners for the native scan event emitted by:
//   - ZebraDataWedgePlugin   (Zebra DataWedge intent delivery)
//   - HoneywellScannerPlugin (Honeywell Scan Wedge + Datalogic Intent Wedge)
//   - GenericIntentScannerPlugin (Urovo, Unitech, CipherLab, Newland, Point Mobile,
//                                 Chainway, Bluebird)
//
// All three plugins emit a "scan" event with shape { value, source, labelType? }.
// This module forwards each event to ScannerBus.emit() so the existing application
// credential flow receives industrial scanner output identically to camera or
// keyboard-wedge input.
//
// On non-Capacitor (browser/desktop) the import of @capacitor/core is dynamic and
// gracefully degrades — no crash if Capacitor is absent.
//
// Call initNativeScannerBridge() once at app startup (e.g. in a root layout).
// It is idempotent; subsequent calls are no-ops.

import { scannerBus, type ScanEvent } from "@/lib/scanner-bus"

let initialized = false

interface NativeScanEvent {
  value:      string
  source:     string
  labelType?: string
}

export async function initNativeScannerBridge(): Promise<void> {
  if (initialized) return
  if (typeof window === "undefined") return

  // Only attempt native plugin registration in a Capacitor WebView
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (!cap || !cap.isNativePlatform?.()) return

  try {
    const { registerPlugin } = await import("@capacitor/core")

    // Type-only interface for each plugin (no SDK dependency required)
    interface ScannerPlugin {
      addListener(event: "scan", handler: (data: NativeScanEvent) => void): Promise<{ remove: () => void }>
      isAvailable(): Promise<{ available: boolean }>
    }

    const ZebraDataWedge   = registerPlugin<ScannerPlugin>("ZebraDataWedge")
    const HoneywellScanner = registerPlugin<ScannerPlugin>("HoneywellScanner")
    const GenericIntentScanner = registerPlugin<ScannerPlugin>("GenericIntentScanner")

    function handleNativeScan(data: NativeScanEvent) {
      if (!data.value) return
      const event: ScanEvent = {
        value:  data.value,
        source: "KEYBOARD_WEDGE",   // native scans resolve through the same bus path
        // We use KEYBOARD_WEDGE so existing scan handlers don't need changes.
        // The raw native source is in the event's underlying data but not exposed
        // through ScanEvent to avoid coupling consumer code to scanner brands.
      }
      scannerBus?.emit(event)
    }

    // Register listeners — do not gate on isAvailable() so the receiver is active
    // even if manufacturer detection is incorrect or the plugin hasn't initialized yet.
    await ZebraDataWedge.addListener("scan", handleNativeScan)
    await HoneywellScanner.addListener("scan", handleNativeScan)
    await GenericIntentScanner.addListener("scan", handleNativeScan)

    initialized = true
  } catch {
    // Capacitor or plugins unavailable — fall back to keyboard-wedge mode silently
  }
}
