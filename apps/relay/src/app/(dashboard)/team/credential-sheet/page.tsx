"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Printer, ChevronLeft, AlertCircle, QrCode, Barcode, KeyRound, Info, CheckCircle } from "lucide-react"
import QRCode from "qrcode"
import JsBarcode from "jsbarcode"

type CredType = "ACCESS_CODE" | "QR" | "BARCODE"

interface CredResult {
  userId: string
  name: string
  employeeId: string | null
  location: string | null
  department: string | null
  credentialType: CredType
  rawValue: string
  masked: string
  isReplacement: boolean
}

interface FilterOption { id: string; name: string }

function QRCard({ result }: { result: CredResult }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(result.rawValue, { width: 120, margin: 1, errorCorrectionLevel: "M" })
      .then(setSrc)
      .catch(() => setSrc(null))
  }, [result.rawValue])

  return (
    <div className="border border-gray-300 rounded-lg p-3 bg-white break-inside-avoid text-center" style={{ pageBreakInside: "avoid" }}>
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Relay QR Badge</div>
      <div className="font-semibold text-gray-900 text-sm truncate mb-1">{result.name}</div>
      {result.employeeId && <div className="text-xs text-gray-400 mb-2">ID: {result.employeeId}</div>}
      {src
        ? <img src={src} alt="QR code" className="mx-auto w-28 h-28" />
        : <div className="mx-auto w-28 h-28 bg-gray-100 flex items-center justify-center text-xs text-gray-400">generating…</div>
      }
      {result.isReplacement && (
        <div className="mt-1 text-xs text-amber-600 font-medium">replaced</div>
      )}
    </div>
  )
}

function BarcodeCard({ result }: { result: CredResult }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    try {
      JsBarcode(svgRef.current, result.rawValue, {
        format: "CODE128",
        displayValue: false,
        width: 1.5,
        height: 50,
        margin: 4,
      })
    } catch {
      // JsBarcode may throw on some values; fall back gracefully
    }
  }, [result.rawValue])

  return (
    <div className="border border-gray-300 rounded-lg p-3 bg-white break-inside-avoid text-center" style={{ pageBreakInside: "avoid" }}>
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Relay Barcode Badge</div>
      <div className="font-semibold text-gray-900 text-sm truncate mb-1">{result.name}</div>
      {result.employeeId && <div className="text-xs text-gray-400 mb-2">ID: {result.employeeId}</div>}
      <svg ref={svgRef} className="mx-auto max-w-full" />
      {result.isReplacement && (
        <div className="mt-1 text-xs text-amber-600 font-medium">replaced</div>
      )}
    </div>
  )
}

function AccessCodeCard({ result }: { result: CredResult }) {
  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-white break-inside-avoid text-center" style={{ pageBreakInside: "avoid" }}>
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Relay Access Code</div>
      <div className="font-semibold text-gray-900 text-sm truncate mb-2">{result.name}</div>
      {result.employeeId && <div className="text-xs text-gray-400 mb-2">ID: {result.employeeId}</div>}
      <div className="font-mono text-2xl font-bold tracking-widest text-gray-900 mb-1 select-all">{result.rawValue}</div>
      {result.location && <div className="text-xs text-gray-400">{result.location}</div>}
      {result.isReplacement && (
        <div className="mt-1 text-xs text-amber-600 font-medium">replaced</div>
      )}
    </div>
  )
}

export default function CredentialSheetPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [credType, setCredType] = useState<CredType>("ACCESS_CODE")
  const [replace, setReplace]   = useState(false)
  const [locationId,   setLocationId]   = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [locations,    setLocations]    = useState<FilterOption[]>([])
  const [departments,  setDepartments]  = useState<FilterOption[]>([])

  const [loading,  setLoading]  = useState(false)
  const [results,  setResults]  = useState<CredResult[] | null>(null)
  const [errors,   setErrors]   = useState<{ userId: string; name: string; error: string }[]>([])
  const [err,      setErr]      = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  // Load filter options
  useEffect(() => {
    void Promise.all([
      fetch("/api/settings/locations").then(r => r.json() as Promise<{ locations: FilterOption[] }>),
      fetch("/api/settings/departments").then(r => r.json() as Promise<{ departments: FilterOption[] }>),
    ]).then(([locData, deptData]) => {
      setLocations(locData.locations ?? [])
      setDepartments(deptData.departments ?? [])
    }).catch(() => undefined)
  }, [])

  // Check if any results would replace existing credentials
  const hasExistingWarning = replace

  async function generate() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch("/api/team/bulk-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:         credType,
          replace,
          ...(locationId   ? { locationId }   : {}),
          ...(departmentId ? { departmentId } : {}),
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setErr(d.error ?? "Failed to generate credentials")
        return
      }
      const data = await res.json() as { results: CredResult[]; errors: { userId: string; name: string; error: string }[] }
      setResults(data.results)
      setErrors(data.errors)
      setConfirmed(false)
    } catch {
      setErr("Connection error.")
    } finally {
      setLoading(false)
    }
  }

  const replacementCount = results?.filter(r => r.isReplacement).length ?? 0

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
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

      {/* Configuration panel */}
      {!results && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:hidden">
          <h2 className="font-semibold text-gray-900 mb-1">Generate Credential Sheet</h2>
          <p className="text-xs text-gray-500 mb-6">
            Generated credentials are shown once and cannot be recovered. Print or save immediately.
          </p>

          {/* Credential type */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Credential Type</label>
            <div className="flex gap-3 flex-wrap">
              {([
                { type: "ACCESS_CODE" as CredType, icon: <KeyRound className="w-4 h-4" />, label: "Access Code", desc: "6-character alphanumeric code" },
                { type: "QR" as CredType, icon: <QrCode className="w-4 h-4" />, label: "QR Badge", desc: "Scannable QR code badge" },
                { type: "BARCODE" as CredType, icon: <Barcode className="w-4 h-4" />, label: "Barcode Badge", desc: "Code 128 barcode badge" },
              ]).map(({ type, icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => setCredType(type)}
                  className={`flex items-start gap-3 p-3 border rounded-lg text-left w-48 transition-colors ${
                    credType === type
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className="mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-5 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Location</label>
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Department</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Replace toggle */}
          <div className="mb-6 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-3">
            <div className="mt-0.5">
              <input
                type="checkbox"
                id="replace-toggle"
                checked={replace}
                onChange={e => setReplace(e.target.checked)}
                className="rounded border-gray-300 text-amber-500"
              />
            </div>
            <div>
              <label htmlFor="replace-toggle" className="text-sm font-medium text-amber-800 cursor-pointer">
                Replace existing credentials
              </label>
              <p className="text-xs text-amber-600 mt-0.5">
                If unchecked, only employees without an existing credential of this type will receive one.
                If checked, all employees will get new credentials and old ones will be revoked.
              </p>
            </div>
          </div>

          {/* One-time disclosure warning */}
          <div className="mb-6 p-3 rounded-lg border border-blue-200 bg-blue-50 flex items-start gap-2 text-xs text-blue-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Credential values are shown <strong>once</strong>. After leaving this page, raw values cannot be recovered.
              Print or save immediately after generation.
            </span>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate Credentials"}
          </button>
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Print controls */}
          <div className="flex items-center gap-3 mb-4 print:hidden flex-wrap">
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
              <span className="text-xs text-red-600">{errors.length} employee(s) failed</span>
            )}
          </div>

          {/* Summary */}
          {(replacementCount > 0 || errors.length > 0) && (
            <div className="mb-4 space-y-2 print:hidden">
              {replacementCount > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-2 text-xs text-amber-700">
                  <Info className="w-4 h-4 shrink-0" />
                  {replacementCount} employee{replacementCount !== 1 ? "s'" : "'s"} existing credentials were replaced.
                  Old credentials are immediately revoked.
                </div>
              )}
              {errors.length > 0 && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                  <p className="text-xs font-medium text-red-700 mb-1">Failed ({errors.length}):</p>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {errors.map(e => <li key={e.userId}>{e.name}: {e.error}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {results.length === 0 && (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200 print:hidden">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No employees matched the selection criteria, or all employees already have this credential type.</p>
            </div>
          )}

          {/* Credential cards */}
          {results.length > 0 && (
            <div className={`grid gap-3 credential-sheet ${
              credType === "BARCODE"
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            }`}>
              {results.map(r =>
                credType === "QR"          ? <QRCard key={r.userId} result={r} /> :
                credType === "BARCODE"     ? <BarcodeCard key={r.userId} result={r} /> :
                                             <AccessCodeCard key={r.userId} result={r} />
              )}
            </div>
          )}

          <style>{`
            @media print {
              .print\\:hidden { display: none !important; }
              body { background: white; }
              .credential-sheet { display: grid !important; gap: 8px !important; }
              .credential-sheet.grid-cols-2 { grid-template-columns: repeat(2, 1fr) !important; }
              .credential-sheet.grid-cols-4 { grid-template-columns: repeat(4, 1fr) !important; }
              .credential-sheet > div { border: 1px solid #aaa !important; border-radius: 4px !important; padding: 8px !important; }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
