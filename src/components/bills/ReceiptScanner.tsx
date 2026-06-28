"use client"
import { useRef, useState } from "react"
import { Camera, Upload, X, ScanLine } from "lucide-react"
import type { ScanResult } from "@/lib/scan-types"

export type { ScanResult }

type Props = {
  onResult: (result: ScanResult) => void
}

export function ReceiptScanner({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function clearImage() {
    setFile(null)
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleScan() {
    if (!file) return
    setScanning(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("image", file)
      const res = await fetch("/api/expenses/scan", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Scan failed")
        return
      }
      onResult(data as ScanResult)
    } catch {
      setError("Network error — check your connection")
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ScanLine className="w-5 h-5 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Scan Receipt</h2>
        <span className="ml-auto text-xs text-gray-400">AI extracts fields — you review before saving</span>
      </div>

      {!preview ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg py-8 gap-3">
          <p className="text-sm text-gray-500">Take a photo or upload a receipt image</p>
          <div className="flex gap-3">
            {/* Mobile: opens back camera. Desktop: opens file picker */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-4 h-4" /> Take Photo / Upload
            </button>
          </div>
          <p className="text-xs text-gray-400">JPG, PNG, HEIC, WEBP</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Receipt preview" className="w-32 h-40 object-cover rounded-lg border border-gray-200" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors"
              aria-label="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <p className="text-sm text-gray-600 font-medium">{file?.name}</p>
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {scanning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Reading receipt…
                </>
              ) : (
                <>
                  <ScanLine className="w-4 h-4" /> Read Receipt
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => { clearImage(); inputRef.current?.click() }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Upload className="w-4 h-4" /> Choose different image
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}
    </div>
  )
}
