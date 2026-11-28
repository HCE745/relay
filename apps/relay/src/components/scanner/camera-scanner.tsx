"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Camera, CameraOff, Loader2, AlertCircle } from "lucide-react"
import { scannerBus } from "@/lib/scanner-bus"

interface Props {
  onScan?: (value: string) => void   // called with the decoded credential value
  active?: boolean                    // parent controls whether camera is active
  className?: string
}

// CameraScanner — ZXing-based multi-format camera scanner.
//
// Supported formats: QR, Code 128, Code 39, Data Matrix, PDF417, UPC-A/E, EAN-8/13, ITF
//
// When a code is decoded it is emitted on ScannerBus (source: "CAMERA") and
// also called via onScan prop for context-local handling.
//
// Duplicate prevention: same value within 2 seconds is ignored.
//
// Works in Capacitor Android WebView and phone/tablet browsers.
// No iOS native app — uses standard browser camera API (getUserMedia).
export function CameraScanner({ onScan, active = true, className }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const readerRef = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null)

  const [status, setStatus]   = useState<"idle" | "starting" | "scanning" | "error">("idle")
  const [errorMsg, setErrMsg] = useState<string | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState<string | undefined>(undefined)

  const lastScanRef = useRef<{ value: string; at: number } | null>(null)

  const stopCamera = useCallback(() => {
    // BrowserMultiFormatReader doesn't have reset(); stop the stream tracks directly
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return
    setStatus("starting")
    setErrMsg(null)

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const { BarcodeFormat, DecodeHintType, NotFoundException } = await import("@zxing/library")

      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.PDF_417,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.EAN_8,
        BarcodeFormat.EAN_13,
        BarcodeFormat.ITF,
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader

      // List available cameras on first use
      if (cameras.length === 0) {
        try {
          const devs = await BrowserMultiFormatReader.listVideoInputDevices()
          setCameras(devs)
          // Prefer a rear-facing camera
          const rear = devs.find(d => /back|rear|environment/i.test(d.label))
          if (rear && !cameraId) setCameraId(rear.deviceId)
        } catch {
          // Camera enumeration may fail without a granted permission; proceed anyway
        }
      }

      setStatus("scanning")

      await reader.decodeFromVideoDevice(cameraId ?? undefined, videoRef.current, (result, err) => {
        if (err instanceof NotFoundException) return   // no barcode in frame — normal

        if (result) {
          const value = result.getText()

          // Duplicate prevention: ignore same value within 2s
          const now = Date.now()
          if (lastScanRef.current?.value === value && now - lastScanRef.current.at < 2000) return
          lastScanRef.current = { value, at: now }

          scannerBus?.emit({ value, source: "CAMERA" })
          onScan?.(value)
        }
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Camera unavailable"
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("allowed")) {
        setErrMsg("Camera permission denied. Allow camera access and try again.")
      } else {
        setErrMsg(msg)
      }
      setStatus("error")
    }
  }, [cameras, cameraId, onScan])

  useEffect(() => {
    if (active) {
      void startCamera()
    } else {
      stopCamera()
      setStatus("idle")
    }
    return () => stopCamera()
  }, [active, cameraId])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative bg-black rounded-xl overflow-hidden ${className ?? "w-full aspect-square max-w-sm"}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Overlay states */}
      {status === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
          <Camera className="w-10 h-10 text-gray-400" />
          <p className="text-sm text-gray-400">Camera inactive</p>
        </div>
      )}

      {status === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-gray-300">Starting camera…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-3 p-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-center text-gray-300">{errorMsg ?? "Camera error"}</p>
          <button
            onClick={() => void startCamera()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Scanning frame overlay */}
      {status === "scanning" && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-8 border-2 border-white/40 rounded-lg" />
          <div className="absolute left-8 top-8 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
          <div className="absolute right-8 top-8 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
          <div className="absolute left-8 bottom-8 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
          <div className="absolute right-8 bottom-8 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
        </div>
      )}

      {/* Camera selector */}
      {status === "scanning" && cameras.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <select
            value={cameraId}
            onChange={e => setCameraId(e.target.value)}
            className="bg-black/70 text-white text-xs px-2 py-1 rounded border border-white/30"
          >
            {cameras.map(c => (
              <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ScanButton — a compact button to toggle the camera scanner in a small slot.
export function ScanButton({ onScan, label = "Scan" }: { onScan: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)

  function handleScan(value: string) {
    setOpen(false)
    onScan(value)
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {open ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
        {open ? "Close Camera" : label}
      </button>
      {open && (
        <div className="mt-2">
          <CameraScanner onScan={handleScan} active={open} className="w-full aspect-square max-w-xs" />
        </div>
      )}
    </div>
  )
}
