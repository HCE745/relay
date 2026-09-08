"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle, AlertCircle, FileText } from "lucide-react"

const FIELDS = [
  { key: "rating",        label: "Rating (1–5)" },
  { key: "feedbackText",  label: "Feedback Text" },
  { key: "customerName",  label: "Customer Name" },
  { key: "customerEmail", label: "Customer Email" },
  { key: "locationName",  label: "Location Name" },
  { key: "submittedAt",   label: "Submitted At (date)" },
]

function parseHeaderRow(csv: string): string[] {
  const firstLine = csv.split(/\r?\n/)[0] ?? ""
  return firstLine.split(",").map(h => h.trim().replace(/^"|"$/g, ""))
}

interface Result { imported: number; skipped: number; errors: string[] }

export function CsvImporter() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  const [csvContent, setCsvContent] = useState("")
  const [headers, setHeaders]     = useState<string[]>([])
  const [mappings, setMappings]   = useState<Record<string, number | "">>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState<Result | null>(null)
  const [error, setError]         = useState("")

  function handleFile(file: File) {
    setFileName(file.name)
    setResult(null)
    setError("")
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsvContent(text)
      const hdrs = parseHeaderRow(text)
      setHeaders(hdrs)
      // Auto-map by common names
      const auto: Record<string, number | ""> = {}
      FIELDS.forEach(f => {
        const idx = hdrs.findIndex(h =>
          h.toLowerCase().replace(/[^a-z]/g, "").includes(f.key.toLowerCase().replace(/[^a-z]/g, ""))
        )
        auto[f.key] = idx >= 0 ? idx : ""
      })
      setMappings(auto)
    }
    reader.readAsText(file)
  }

  async function runImport() {
    setImporting(true); setError(""); setResult(null)
    const finalMappings: Record<string, number> = {}
    Object.entries(mappings).forEach(([k, v]) => { if (v !== "") finalMappings[k] = v as number })
    try {
      const res = await fetch("/api/customer-voice/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ csvContent, mappings: finalMappings }),
      })
      const j = await res.json() as Result & { error?: string }
      if (!res.ok) throw new Error(j.error ?? "Import failed")
      setResult(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Upload */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-10 text-center cursor-pointer transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {fileName ? (
          <>
            <FileText className="w-10 h-10 text-blue-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900">{fileName}</p>
            <p className="text-sm text-gray-500 mt-1">{headers.length} column{headers.length !== 1 ? "s" : ""} detected · Click to change</p>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">Drop a CSV file here, or click to upload</p>
            <p className="text-sm text-gray-400 mt-1">Must include at least a rating or feedback text column</p>
          </>
        )}
      </div>

      {/* Column mapping */}
      {headers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Map Columns</h2>
          <div className="space-y-3">
            {FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-4">
                <span className="w-44 text-sm text-gray-700 shrink-0">{f.label}</span>
                <select
                  value={mappings[f.key] ?? ""}
                  onChange={e => setMappings(m => ({ ...m, [f.key]: e.target.value === "" ? "" : Number(e.target.value) }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— skip —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={runImport}
            disabled={importing}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors"
          >
            {importing ? "Importing…" : "Import Feedback"}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <p className="font-semibold text-gray-900">Import complete</p>
              <p className="text-sm text-gray-500">{result.imported} imported · {result.skipped} skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Row errors ({result.errors.length}):</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
