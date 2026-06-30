"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, AlertTriangle, CheckCircle2, RefreshCw, FileText, ExternalLink } from "lucide-react"
import { ReceiptScanner } from "./ReceiptScanner"
import type { ScanResult } from "@/lib/scan-types"

type Account = { id: string; code: string; name: string }
type Vendor = { id: string; name: string }
type Klass = { id: string; name: string }
type Dept = { id: string; name: string }

export type BillFormProps = {
  entityId: string
  vendors: Vendor[]
  expenseAccounts: Account[]
  classes: Klass[]
  departments: Dept[]
}

type LineItem = {
  key: string
  description: string
  accountId: string
  quantity: string
  unitPrice: string
  classId: string
  departmentId: string
}

let _key = 0
function newLine(): LineItem {
  return { key: String(++_key), description: "", accountId: "", quantity: "1", unitPrice: "", classId: "", departmentId: "" }
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function plus30() { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) }
function dollarsToCents(s: string) { return Math.round((parseFloat(s) || 0) * 100) }
function fmtCents(c: number) { return (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }) }
function centsToStr(c: number | null) { return c != null ? (c / 100).toFixed(2) : "" }

const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const label = "block text-sm font-medium text-gray-700 mb-1"

export function BillForm({ entityId, vendors, expenseAccounts, classes, departments }: BillFormProps) {
  const router = useRouter()
  const [vendorId, setVendorId] = useState("")
  const [newVendorName, setNewVendorName] = useState("")
  const [billNumber, setBillNumber] = useState("")
  const [date, setDate] = useState(todayStr)
  const [dueDate, setDueDate] = useState(plus30)
  const [memo, setMemo] = useState("")
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // TODO: add isRecurring + recurringReason to Bill schema to persist; for now it's UI-only
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringReason, setRecurringReason] = useState<string | null>(null)

  // Receipt preview: localUrl is an objectURL from the browser file; receiptUrl is the persisted blob URL
  const [receiptLocalUrl, setReceiptLocalUrl] = useState<string | null>(null)
  const [receiptLocalIsPdf, setReceiptLocalIsPdf] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  const [scanBanner, setScanBanner] = useState<{
    confidence: ScanResult["confidence"]
    vendorName: string | null
    totalCents: number | null
    allFilled: boolean
  } | null>(null)

  function updateLine(key: string, field: keyof LineItem, val: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)))
  }
  function addLine() { setLines((p) => [...p, newLine()]) }
  function removeLine(key: string) { setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p)) }

  const totalCents = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0
    return s + Math.round(qty * dollarsToCents(l.unitPrice))
  }, 0)

  function handleScanResult(result: ScanResult, localUrl: string) {
    // Detect file type from the local URL (pdf blob type)
    const isPdfLocal = localUrl.startsWith("blob:") && result.receiptUrl
      ? result.receiptUrl.endsWith(".pdf")
      : false
    setReceiptLocalUrl(localUrl)
    setReceiptLocalIsPdf(isPdfLocal)
    if (result.receiptUrl) setReceiptUrl(result.receiptUrl)

    // Vendor: model-matched ID wins; fall back to client fuzzy match; then flag as new
    if (result.matchedVendorId) {
      setVendorId(result.matchedVendorId)
      setNewVendorName("")
    } else if (result.vendorName) {
      const lower = result.vendorName.toLowerCase()
      const fuzzy = vendors.find(
        (v) => v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase())
      )
      if (fuzzy) {
        setVendorId(fuzzy.id)
        setNewVendorName("")
      } else {
        setVendorId("_new_")
        setNewVendorName(result.vendorName)
      }
    }

    if (result.date) setDate(result.date)

    // Build lines with account IDs pre-selected; fall back to overallSuggestedAccountId
    let newLines: LineItem[]
    if (result.lineItems && result.lineItems.length > 0) {
      newLines = result.lineItems.map((li) => ({
        key: String(++_key),
        description: li.description,
        accountId: li.suggestedAccountId ?? result.overallSuggestedAccountId ?? "",
        quantity: "1",
        unitPrice: centsToStr(li.amountCents),
        classId: "",
        departmentId: "",
      }))
    } else if (result.totalCents) {
      newLines = [{
        key: String(++_key),
        description: result.vendorName ?? "",
        accountId: result.overallSuggestedAccountId ?? "",
        quantity: "1",
        unitPrice: centsToStr(result.totalCents),
        classId: "",
        departmentId: "",
      }]
    } else {
      newLines = [newLine()]
    }
    setLines(newLines)

    setIsRecurring(result.isLikelyRecurring ?? false)
    setRecurringReason(result.recurringReason ?? null)

    const vendorFilled = !!(result.matchedVendorId ?? (result.vendorName ? "_new_" : null))
    const allAccountsFilled = newLines.every((l) => !!l.accountId)
    setScanBanner({
      confidence: result.confidence,
      vendorName: result.vendorName,
      totalCents: result.totalCents,
      allFilled: vendorFilled && allAccountsFilled,
    })
  }

  async function handleSave() {
    const hasVendor = vendorId && vendorId !== "_new_" ? vendorId : null
    if (!hasVendor && !newVendorName) { setError("Select a vendor"); return }
    if (lines.some((l) => !l.accountId)) { setError("Select an expense account for every line item"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          vendorId: hasVendor || undefined,
          newVendorName: !hasVendor ? newVendorName : undefined,
          billNumber: billNumber || undefined,
          date,
          dueDate,
          memo: memo || undefined,
          receiptUrl: receiptUrl || undefined,
          lines: lines.map((l) => ({
            description: l.description || undefined,
            accountId: l.accountId,
            quantity: parseFloat(l.quantity) || 1,
            unitPrice: dollarsToCents(l.unitPrice),
            classId: l.classId || undefined,
            departmentId: l.departmentId || undefined,
          })),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save") }
      const bill = await res.json()
      router.push(`/bills/${bill.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Enter Bill</h1>

      <ReceiptScanner onResult={handleScanResult} />

      {/* Receipt preview panel — shown after scan, persists while form is open */}
      {receiptLocalUrl && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-start gap-4">
          <div className="flex-shrink-0">
            {receiptLocalIsPdf ? (
              <div className="w-20 h-24 flex flex-col items-center justify-center bg-red-50 rounded-lg border border-red-200 gap-1">
                <FileText className="w-7 h-7 text-red-500" />
                <span className="text-xs text-red-600 font-medium">PDF</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptLocalUrl} alt="Receipt" className="w-20 h-24 object-cover rounded-lg border border-gray-200" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 mb-2">Receipt attached</p>
            <a
              href={receiptLocalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {receiptLocalIsPdf ? "Open PDF in new tab" : "View full size"}
            </a>
            {receiptUrl && (
              <p className="mt-1 text-xs text-green-600">✓ Saved to cloud — visible from bill detail after saving</p>
            )}
            {!receiptUrl && (
              <p className="mt-1 text-xs text-gray-400">Will be viewable here until you navigate away; cloud storage requires BLOB_READ_WRITE_TOKEN</p>
            )}
          </div>
        </div>
      )}

      {/* Scan banner */}
      {scanBanner && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
          scanBanner.confidence === "high" && scanBanner.allFilled
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          {scanBanner.confidence === "high" && scanBanner.allFilled
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          }
          <div>
            {scanBanner.confidence === "high" && scanBanner.allFilled ? (
              <span>
                All fields filled
                {scanBanner.vendorName && <> — <strong>{scanBanner.vendorName}</strong></>}
                {scanBanner.totalCents != null && <>, total <strong>${fmtCents(scanBanner.totalCents)}</strong></>}.
                {" "}Review and save.
              </span>
            ) : scanBanner.allFilled ? (
              <span>
                Fields pre-filled
                {scanBanner.vendorName && <> — <strong>{scanBanner.vendorName}</strong></>}
                {scanBanner.totalCents != null && <>, total <strong>${fmtCents(scanBanner.totalCents)}</strong></>}.
                {" "}<strong>Double-check before saving</strong> (confidence: {scanBanner.confidence}).
              </span>
            ) : (
              <span>
                <strong>Some fields need attention</strong>
                {scanBanner.vendorName && <> — vendor: <em>{scanBanner.vendorName}</em></>}
                {scanBanner.totalCents != null && <>, total: <strong>${fmtCents(scanBanner.totalCents)}</strong></>}.
                {" "}Assign the highlighted expense accounts before saving.
                {scanBanner.confidence !== "high" && <> Confidence: <strong>{scanBanner.confidence}</strong>.</>}
              </span>
            )}
          </div>
          <button type="button" onClick={() => setScanBanner(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* New vendor notice */}
      {vendorId === "_new_" && newVendorName && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>New vendor <strong>{newVendorName}</strong> will be created when you save. Or select an existing vendor below.</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={label}>Vendor *</label>
            <select
              value={vendorId}
              onChange={(e) => {
                if (e.target.value !== "_new_") setNewVendorName("")
                setVendorId(e.target.value)
              }}
              className={input}
            >
              <option value="">Select vendor…</option>
              {newVendorName && (
                <option value="_new_">+ New vendor: {newVendorName}</option>
              )}
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Bill Number</label>
            <input type="text" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="e.g. V-1234 (optional)" className={input} />
          </div>
          <div>
            <label className={label}>Bill Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Due Date *</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label}>Memo</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional note" className={input} />
          </div>

          {/* Recurring — pre-filled from scan; UI-only until Bill schema gains isRecurring */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <RefreshCw className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Recurring bill</span>
            </label>
            {isRecurring && recurringReason && (
              <p className="mt-1 ml-6 text-xs text-gray-500">{recurringReason}</p>
            )}
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
          <button type="button" onClick={addLine} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Add Line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Description</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Expense Account *</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-20">Qty</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-32">Unit Price</th>
                {classes.length > 0 && <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Class</th>}
                {departments.length > 0 && <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Dept</th>}
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-28">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const lineCents = Math.round((parseFloat(line.quantity) || 0) * dollarsToCents(line.unitPrice))
                const accountMissing = !line.accountId && !!scanBanner
                return (
                  <tr key={line.key} className="border-b border-gray-100">
                    <td className="px-4 py-2">
                      <input type="text" value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} placeholder="Description" className={input} />
                    </td>
                    <td className="px-4 py-2 min-w-[180px]">
                      <select
                        value={line.accountId}
                        onChange={(e) => updateLine(line.key, "accountId", e.target.value)}
                        className={`${input} ${accountMissing ? "border-amber-400 ring-1 ring-amber-300" : ""}`}
                      >
                        <option value="">Select…</option>
                        {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" min="0" step="1" value={line.quantity} onChange={(e) => updateLine(line.key, "quantity", e.target.value)} className={input} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} placeholder="0.00" className={`${input} pl-6`} />
                      </div>
                    </td>
                    {classes.length > 0 && (
                      <td className="px-4 py-2">
                        <select value={line.classId} onChange={(e) => updateLine(line.key, "classId", e.target.value)} className={input}>
                          <option value="">None</option>
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                    )}
                    {departments.length > 0 && (
                      <td className="px-4 py-2">
                        <select value={line.departmentId} onChange={(e) => updateLine(line.key, "departmentId", e.target.value)} className={input}>
                          <option value="">None</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right font-mono text-sm text-gray-900">${fmtCents(lineCents)}</td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => removeLine(line.key)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
          <div className="flex items-center gap-8 font-semibold text-base">
            <span>Total</span>
            <span className="font-mono w-28 text-right">${fmtCents(totalCents)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : "Enter Bill"}
        </button>
        <p className="text-xs text-gray-400">Posts DR Expense / CR Accounts Payable immediately</p>
        <button type="button" onClick={() => router.back()} className="ml-auto px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
