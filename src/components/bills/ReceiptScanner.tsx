"use client"

import { useRef, useState } from "react"
import { Camera, Upload, X, ScanLine, FileText, ExternalLink } from "lucide-react"
import type { ScanResult } from "@/lib/scan-types"

export type { ScanResult }

type Props = {
  // localUrl is an objectURL for the file (stays valid as long as the component is mounted)
  onResult: (result: ScanResult, localUrl: string) => void
}

export function ReceiptScanner({ onResult }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setScanned(false)
    if (f.type === "application/pdf") {
      setPreview("pdf")
    } else {
      setPreview(URL.createObjectURL(f))
    }
  }

  function clearFile() {
    setFile(null)
    setPreview(null)
    setError(null)
    setScanned(false)
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (uploadInputRef.current) uploadInputRef.current.value = ""
  }

  async function handleScan() {
    if (!file) return
    setScanning(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/expenses/scan", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Scan failed")
        return
      }
      // Generate a stable objectURL for this file so BillForm can show it
      const localUrl = file.type === "application/pdf"
        ? URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: "application/pdf" }))
        : (preview ?? URL.createObjectURL(file))
      setScanned(true)
      onResult(data as ScanResult, localUrl)
    } catch {
      setError("Network error — check your connection")
    } finally {
      setScanning(false)
    }
  }

  const isPdf = file?.type === "application/pdf"

  return (
    <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ScanLine className="w-5 h-5 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Scan Receipt</h2>
        <span className="ml-auto text-xs text-gray-400">AI extracts fields — you review before saving</span>
      </div>

      {!preview ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg py-8 gap-3">
          <p className="text-sm text-gray-500">Take a photo or upload a receipt image or PDF</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-4 h-4" /> Take Photo
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" /> Upload File
            </button>
          </div>
          <p className="text-xs text-gray-400">JPG, PNG, WEBP or PDF</p>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          <input ref={uploadInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          <div className="relative flex-shrink-0">
            {isPdf ? (
              <div className="w-32 h-40 flex flex-col items-center justify-center bg-red-50 rounded-lg border border-red-200 gap-2">
                <FileText className="w-10 h-10 text-red-500" />
                <span className="text-xs text-red-600 font-medium text-center px-2 leading-tight">PDF</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Receipt preview" className="w-32 h-40 object-cover rounded-lg border border-gray-200" />
            )}
            <button
              type="button"
              onClick={clearFile}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors"
              aria-label="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <p className="text-sm text-gray-600 font-medium">{file?.name}</p>

            {isPdf && preview && preview !== "pdf" ? (
              <a
                href={preview}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View PDF
              </a>
            ) : isPdf ? null : preview ? (
              <a
                href={preview}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View full size
              </a>
            ) : null}

            {!scanned ? (
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
            ) : (
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <ScanLine className="w-4 h-4" /> Re-scan
              </button>
            )}

            <button
              type="button"
              onClick={() => { clearFile(); uploadInputRef.current?.click() }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Upload className="w-4 h-4" /> Choose different file
            </button>

            {/* Keep both inputs mounted so refs stay valid in preview state */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={uploadInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}
    </div>
  )
}
