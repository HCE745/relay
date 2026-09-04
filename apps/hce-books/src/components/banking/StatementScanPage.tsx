"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react"
import type { StatementLine, StatementScanResponse } from "@/app/api/banking/statement-scan/route"

type Vendor = { id: string; name: string }
type Account = { id: string; code: string; name: string }

type Props = {
  entityId: string
  vendors: Vendor[]
  expenseAccounts: Account[]
}

type BillDraft = {
  vendorId: string
  newVendorName: string
  accountId: string
  date: string
  amountCents: number
  description: string
}

type LineState = {
  line: StatementLine
  creating: boolean
  created: boolean
  billId: string | null
  error: string | null
  draft: BillDraft
  expanded: boolean
}

const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

function amountLabel(cents: number) {
  const abs = Math.abs(cents) / 100
  const sign = cents < 0 ? "−" : ""
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
}

function defaultDraft(line: StatementLine, vendors: Vendor[], accounts: Account[]): BillDraft {
  const vendorMatch = vendors.find((v) =>
    line.description.toLowerCase().includes(v.name.toLowerCase()) ||
    v.name.toLowerCase().includes(line.description.toLowerCase().split(/\s+/)[0])
  )
  return {
    vendorId: vendorMatch?.id ?? "",
    newVendorName: vendorMatch ? "" : line.description.split(/[^a-zA-Z0-9 ]/)[0].trim().slice(0, 50),
    accountId: accounts[0]?.id ?? "",
    date: line.date,
    amountCents: Math.abs(line.amountCents),
    description: line.description,
  }
}

export function StatementScanPage({ entityId, vendors, expenseAccounts }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [result, setResult] = useState<StatementScanResponse | null>(null)
  const [lineStates, setLineStates] = useState<LineState[]>([])
  const [matchedExpanded, setMatchedExpanded] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError(null)
    setResult(null)
    setLineStates([])
    setScanning(true)

    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/banking/statement-scan", { method: "POST", body: form })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Scan failed")
      }
      const data: StatementScanResponse = await res.json()
      setResult(data)
      setLineStates(
        data.lines.map((line) => ({
          line,
          creating: false,
          created: false,
          billId: null,
          error: null,
          draft: defaultDraft(line, vendors, expenseAccounts),
          expanded: false,
        }))
      )
    } catch (err) {
      setScanError((err as Error).message)
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function updateDraft(idx: number, patch: Partial<BillDraft>) {
    setLineStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, draft: { ...s.draft, ...patch } } : s))
    )
  }

  function toggleExpanded(idx: number) {
    setLineStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, expanded: !s.expanded } : s))
    )
  }

  async function createBill(idx: number) {
    const state = lineStates[idx]
    const { draft } = state
    const realVendorId = draft.vendorId || null
    if (!realVendorId && !draft.newVendorName) return
    if (!draft.accountId) return

    setLineStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, creating: true, error: null } : s))
    )

    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          vendorId: realVendorId || undefined,
          newVendorName: !realVendorId ? draft.newVendorName : undefined,
          date: draft.date,
          dueDate: draft.date,
          memo: draft.description,
          lines: [
            {
              description: draft.description,
              accountId: draft.accountId,
              quantity: 1,
              unitPrice: draft.amountCents,
            },
          ],
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to create bill")
      }
      const bill = await res.json()
      setLineStates((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, creating: false, created: true, billId: bill.id, expanded: false } : s
        )
      )
    } catch (err) {
      setLineStates((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, creating: false, error: (err as Error).message } : s
        )
      )
    }
  }

  const unmatchedWithIdx = lineStates
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.line.matchType === null)
  const matchedItems = lineStates.filter((s) => s.line.matchType !== null)

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statement Reconciliation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a PDF bank or credit card statement. Transactions are matched against existing bills and journal entries. Unmatched lines can be entered as bills with one click.
        </p>
      </div>

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {scanning ? (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-sm text-blue-600 font-medium">Scanning statement…</p>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-gray-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Click to upload a PDF statement</p>
              <p className="text-xs text-gray-400 mt-1">PDF only · max 20 MB</p>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
      </div>

      {scanError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {scanError}
        </div>
      )}

      {result && (
        <>
          {/* Header summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1">
            {result.alreadyProcessed && result.processedAt && (
              <div className="flex items-center gap-2 text-amber-700 text-sm mb-3">
                <AlertTriangle className="w-4 h-4" />
                This statement was previously processed on {new Date(result.processedAt).toLocaleDateString()}. Creating bills again may create duplicates — review carefully.
              </div>
            )}
            {result.accountName && <p className="text-sm font-medium text-gray-900">{result.accountName}</p>}
            {result.periodStart && result.periodEnd && (
              <p className="text-xs text-gray-500">
                Period: {result.periodStart} → {result.periodEnd}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {result.lines.length} transactions · {matchedItems.length} matched · {unmatchedWithIdx.length} unmatched
            </p>
          </div>

          {/* Unmatched transactions */}
          {unmatchedWithIdx.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 rounded-t-xl">
                <h2 className="text-sm font-semibold text-amber-900">
                  {unmatchedWithIdx.length} Unmatched Transaction{unmatchedWithIdx.length !== 1 ? "s" : ""}
                </h2>
                <p className="text-xs text-amber-700 mt-0.5">No existing bill or entry found. Review and create bills as needed.</p>
              </div>

              <div className="divide-y divide-gray-100">
                {unmatchedWithIdx.map(({ s, i }) => (
                  <div key={i} className="px-5 py-4">
                    {/* Summary row */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.line.description}</p>
                        <p className="text-xs text-gray-400">{s.line.date}</p>
                      </div>
                      <span className="text-sm font-mono font-semibold text-gray-900 whitespace-nowrap">
                        {amountLabel(s.line.amountCents)}
                      </span>

                      {s.created ? (
                        <a
                          href={`/bills/${s.billId}`}
                          className="flex items-center gap-1 text-xs text-green-700 font-medium hover:text-green-800"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Bill created
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(i)}
                          className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-700"
                        >
                          {s.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          {s.expanded ? "Collapse" : "Create Bill"}
                        </button>
                      )}
                    </div>

                    {/* Expanded bill draft form */}
                    {s.expanded && !s.created && (
                      <div className="mt-4 space-y-3 pl-1">
                        {s.error && (
                          <p className="text-xs text-red-600">{s.error}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                            <select
                              value={s.draft.vendorId}
                              onChange={(e) => updateDraft(i, { vendorId: e.target.value, newVendorName: "" })}
                              className={input}
                            >
                              <option value="">Select or enter below…</option>
                              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">New vendor name</label>
                            <input
                              type="text"
                              value={s.draft.vendorId ? "" : s.draft.newVendorName}
                              disabled={!!s.draft.vendorId}
                              onChange={(e) => updateDraft(i, { newVendorName: e.target.value })}
                              placeholder="Or type a new name…"
                              className={`${input} ${s.draft.vendorId ? "opacity-40 cursor-not-allowed bg-gray-50" : ""}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Expense Account *</label>
                            <select
                              value={s.draft.accountId}
                              onChange={(e) => updateDraft(i, { accountId: e.target.value })}
                              className={input}
                            >
                              <option value="">Select…</option>
                              {expenseAccounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <input
                              type="date"
                              value={s.draft.date}
                              onChange={(e) => updateDraft(i, { date: e.target.value })}
                              className={input}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            disabled={s.creating || (!s.draft.vendorId && !s.draft.newVendorName) || !s.draft.accountId}
                            onClick={() => createBill(i)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {s.creating ? (
                              <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</span>
                            ) : (
                              `Create Bill — ${amountLabel(s.line.amountCents)}`
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(i)}
                            className="text-sm text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched transactions (collapsed by default) */}
          {matchedItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <button
                type="button"
                className="w-full px-5 py-3 bg-green-50 border-b border-green-100 rounded-t-xl flex items-center gap-2 text-left"
                onClick={() => setMatchedExpanded((v) => !v)}
              >
                {matchedExpanded ? <ChevronDown className="w-4 h-4 text-green-700" /> : <ChevronRight className="w-4 h-4 text-green-700" />}
                <div>
                  <span className="text-sm font-semibold text-green-900">
                    {matchedItems.length} Matched Transaction{matchedItems.length !== 1 ? "s" : ""}
                  </span>
                  <span className="ml-2 text-xs text-green-700">— already in the books</span>
                </div>
              </button>

              {matchedExpanded && (
                <div className="divide-y divide-gray-100">
                  {matchedItems.map((s, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{s.line.description}</p>
                        <p className="text-xs text-gray-400">{s.line.date} · {s.line.matchedLabel}</p>
                      </div>
                      <span className="text-sm font-mono text-gray-600 whitespace-nowrap">
                        {amountLabel(s.line.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
