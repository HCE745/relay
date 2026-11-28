"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Printer, ChevronLeft, AlertCircle } from "lucide-react"

interface Result {
  userId: string
  name: string
  rawCode: string
  masked: string
}

export default function CredentialSheetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)
  const [errors, setErrors]   = useState<{ userId: string; error: string }[]>([])
  const [err, setErr]         = useState<string | null>(null)

  async function generate() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch("/api/team/bulk-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Failed"); return }
      const data = await res.json() as { results: Result[]; errors: { userId: string; error: string }[] }
      setResults(data.results)
      setErrors(data.errors)
    } catch {
      setErr("Connection error.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Bulk Credential Sheet</h1>
      </div>

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700 print:hidden">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {err}
        </div>
      )}

      {!results && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center print:hidden">
          <Printer className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h2 className="font-semibold text-gray-900 mb-2">Generate Credential Sheet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Generates a new access code for every active employee in your organization and displays them in a printable format. Existing codes will be replaced.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate All Credentials"}
          </button>
        </div>
      )}

      {results && (
        <>
          {/* Print controls — hidden in print */}
          <div className="flex items-center gap-3 mb-6 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              Print Sheet
            </button>
            <button
              onClick={() => { setResults(null); setErrors([]) }}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
            >
              Generate Again
            </button>
            {errors.length > 0 && (
              <span className="text-xs text-red-600">{errors.length} employee(s) failed to generate</span>
            )}
          </div>

          {/* Printable credential cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 credential-sheet">
            {results.map(r => (
              <div
                key={r.userId}
                className="border border-gray-300 rounded-lg p-4 text-center bg-white break-inside-avoid"
                style={{ pageBreakInside: "avoid" }}
              >
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Relay Access</div>
                <div className="font-semibold text-gray-900 text-sm mb-3 truncate">{r.name}</div>
                <div className="font-mono text-2xl font-bold tracking-widest text-gray-900 mb-1">{r.rawCode}</div>
                <div className="text-xs text-gray-400">Access Code</div>
              </div>
            ))}
          </div>

          <style>{`
            @media print {
              .print\\:hidden { display: none !important; }
              body { background: white; }
              .credential-sheet { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
              .credential-sheet > div { border: 1px solid #aaa; border-radius: 6px; padding: 12px; }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
