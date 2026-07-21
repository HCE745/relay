"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, AlertTriangle, CheckCircle2, RefreshCw, FileText, ExternalLink, Calendar } from "lucide-react"
import { ReceiptScanner } from "./ReceiptScanner"
import type { ScanResult } from "@/lib/scan-types"

type Account = { id: string; code: string; name: string }
type Vendor = { id: string; name: string }
type Klass = { id: string; name: string }
type Dept = { id: string; name: string }

type POPrefill = {
  poId: string
  poNumber: string | null
  vendorId: string
  vendorName: string
  lines: { description: string; qty: number; unitPriceCents: number; accountId: string }[]
}

export type BillFormProps = {
  entityId: string
  vendors: Vendor[]
  expenseAccounts: Account[]
  assetAccounts?: Account[]
  classes: Klass[]
  departments: Dept[]
  poPrefill?: POPrefill | null
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

export function BillForm({ entityId, vendors, expenseAccounts, assetAccounts = [], classes, departments, poPrefill }: BillFormProps) {
  const router = useRouter()

  // vendorList is the live vendor list — initialized from SSR prop, refreshed after each scan
  const [vendorList, setVendorList] = useState<Vendor[]>(vendors)
  const [vendorId, setVendorId] = useState(poPrefill?.vendorId ?? "")
  // _new_ sentinel: fallback when the scan route couldn't create a vendor (no session/entity)
  const [newVendorName, setNewVendorName] = useState("")

  const [billNumber, setBillNumber] = useState("")
  const [date, setDate] = useState(todayStr)
  const [dueDate, setDueDate] = useState(plus30)
  const [memo, setMemo] = useState("")
  const [lines, setLines] = useState<LineItem[]>(
    poPrefill && poPrefill.lines.length > 0
      ? poPrefill.lines.map((l) => ({
          key: String(++_key),
          description: l.description,
          accountId: l.accountId,
          quantity: String(l.qty),
          unitPrice: (l.unitPriceCents / 100).toFixed(2),
          classId: "",
          departmentId: "",
        }))
      : [newLine()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringReason, setRecurringReason] = useState<string | null>(null)

  const [isLikelyAnnualOrTermContract, setIsLikelyAnnualOrTermContract] = useState(false)
  const [doAmortize, setDoAmortize] = useState(false)
  const [amortizeMonths, setAmortizeMonths] = useState<string>("12")
  const [prepaidAccountId, setPrepaidAccountId] = useState("")

  const [receiptLocalUrl, setReceiptLocalUrl] = useState<string | null>(null)
  const [receiptLocalIsPdf, setReceiptLocalIsPdf] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  const [scanBanner, setScanBanner] = useState<{
    confidence: ScanResult["confidence"]
    vendorName: string | null
    totalCents: number | null
    allFilled: boolean
    vendorMissing: boolean
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

  async function handleScanResult(result: ScanResult, localUrl: string) {
    console.log("FORM RECEIVED:", {
      keys: Object.keys(result as object),
      matchedVendorId: result.matchedVendorId,
      vendorName: result.vendorName,
      createdVendorName: result.createdVendorName,
      overallSuggestedAccountId: result.overallSuggestedAccountId,
      totalCents: result.totalCents,
      confidence: result.confidence,
    })

    // Receipt
    const isPdf = localUrl.endsWith(".pdf") || result.createdVendorName?.endsWith(".pdf") === false
    // Detect PDF by checking if the local objectURL was created from a PDF blob
    setReceiptLocalUrl(localUrl)
    setReceiptLocalIsPdf(false) // Will be determined from original file type in ReceiptScanner
    if (result.receiptUrl) setReceiptUrl(result.receiptUrl)

    // Date
    if (result.date) setDate(result.date)

    // Lines
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

    if (result.isLikelyAnnualOrTermContract) {
      setIsLikelyAnnualOrTermContract(true)
      setDoAmortize(true)
      if (result.detectedTermMonths) setAmortizeMonths(String(result.detectedTermMonths))
      // Default prepaid account to first asset account with "prepaid" in name, or first asset
      if (!prepaidAccountId && assetAccounts.length > 0) {
        const prepaid = assetAccounts.find((a) => a.name.toLowerCase().includes("prepaid"))
        setPrepaidAccountId(prepaid?.id ?? assetAccounts[0].id)
      }
    }

    // Step 1: Inject newly created vendor into the local list immediately from the
    // scan response. This makes the dropdown work even before the API refresh returns.
    // The scan route always returns matchedVendorId when it creates or finds a vendor.
    let workingVendors = vendorList
    const resolvedId = result.matchedVendorId
    const resolvedName = result.createdVendorName ?? result.vendorName

    if (resolvedId && resolvedName && !workingVendors.some((v) => v.id === resolvedId)) {
      workingVendors = [{ id: resolvedId, name: resolvedName }, ...workingVendors]
      setVendorList(workingVendors)
      console.log("[BillForm] injected new vendor into list immediately:", resolvedId, resolvedName)
    }

    // Step 2: Refresh vendor list from DB — pass entityId as query param so the
    // route doesn't have to guess entity from cookies (which can resolve differently).
    let freshVendors = workingVendors
    try {
      const res = await fetch(`/api/vendors?entityId=${encodeURIComponent(entityId)}`)
      console.log("[BillForm] /api/vendors status:", res.status)
      if (res.ok) {
        const apiVendors: Vendor[] = await res.json()
        // Merge: API list is authoritative but also keep any vendor we just injected
        // in case the DB list doesn't include it yet (race condition)
        if (resolvedId && resolvedName && !apiVendors.some((v) => v.id === resolvedId)) {
          freshVendors = [{ id: resolvedId, name: resolvedName }, ...apiVendors]
        } else {
          freshVendors = apiVendors
        }
        setVendorList(freshVendors)
        console.log("[BillForm] refreshed vendor list:", freshVendors.map((v) => v.name))
      } else {
        const body = await res.text().catch(() => "")
        console.error("[BillForm] /api/vendors error:", res.status, body)
        freshVendors = workingVendors // keep the injected vendor
      }
    } catch (err) {
      console.warn("[BillForm] vendor list refresh failed:", err)
      freshVendors = workingVendors
    }

    console.log("VENDOR OPTIONS AVAILABLE:", freshVendors.map((v) => ({ id: v.id, name: v.name })))

    // Step 3: Set the dropdown value.
    // Priority: matchedVendorId (created/found server-side) → client fuzzy match → _new_ sentinel
    if (result.matchedVendorId) {
      setVendorId(result.matchedVendorId)
      setNewVendorName("")
      console.log("SETTING VENDOR VALUE TO:", result.matchedVendorId,
        "(name:", freshVendors.find((v) => v.id === result.matchedVendorId)?.name ?? "NOT IN LIST — defensive inject will cover it", ")")
    } else if (result.vendorName) {
      const lower = result.vendorName.toLowerCase()
      const fuzzy = freshVendors.find(
        (v) => v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase())
      )
      if (fuzzy) {
        setVendorId(fuzzy.id)
        setNewVendorName("")
        console.log("SETTING VENDOR VALUE TO:", fuzzy.id, "(client fuzzy match:", fuzzy.name, ")")
      } else {
        // Fallback: scan couldn't create vendor (no session/entity) — defer creation to save
        setVendorId("_new_")
        setNewVendorName(result.vendorName)
        console.log("SETTING VENDOR VALUE TO: _new_ for:", result.vendorName, "(scan couldn't create vendor)")
      }
    } else {
      // No vendor on document — leave the field blank so user can enter it
      setVendorId("")
      setNewVendorName("")
      console.log("VENDOR: null from model — leaving field empty for user to fill")
    }

    const vendorFilled = !!(result.matchedVendorId || result.vendorName)
    const allAccountsFilled = newLines.every((l) => !!l.accountId)
    setScanBanner({
      confidence: result.confidence,
      vendorName: result.vendorName,
      totalCents: result.totalCents,
      allFilled: vendorFilled && allAccountsFilled,
      vendorMissing: !vendorFilled,
    })
  }

  async function handleSave() {
    const realVendorId = vendorId && vendorId !== "_new_" ? vendorId : null
    if (!realVendorId && !newVendorName) { setError("Select a vendor"); return }
    if (lines.some((l) => !l.accountId)) { setError("Select an expense account for every line item"); return }
    if (doAmortize && !prepaidAccountId) { setError("Select a prepaid asset account to amortize"); return }
    if (doAmortize && (Number(amortizeMonths) < 1 || Number(amortizeMonths) > 360)) {
      setError("Amortize months must be between 1 and 360"); return
    }
    setSaving(true); setError("")

    const billPayload = {
      entityId,
      vendorId: realVendorId || undefined,
      newVendorName: !realVendorId ? newVendorName : undefined,
      billNumber: billNumber || undefined,
      date,
      dueDate,
      memo: memo || undefined,
      receiptUrl: receiptUrl || undefined,
      poId: poPrefill?.poId ?? undefined,
    }

    try {
      if (doAmortize && prepaidAccountId) {
        // Save the expense account from the first line for the amortization schedule
        const expenseAccountId = lines[0]?.accountId ?? ""

        // Post bill with prepaid asset account replacing expense accounts (DR Prepaid / CR AP)
        const billRes = await fetch("/api/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...billPayload,
            lines: lines.map((l) => ({
              description: l.description || undefined,
              accountId: prepaidAccountId,
              quantity: parseFloat(l.quantity) || 1,
              unitPrice: dollarsToCents(l.unitPrice),
              classId: l.classId || undefined,
              departmentId: l.departmentId || undefined,
            })),
          }),
        })
        if (!billRes.ok) { const d = await billRes.json(); throw new Error(d.error || "Failed to save bill") }
        const bill = await billRes.json()

        // Create amortization schedule (monthly: DR Expense / CR Prepaid Asset)
        const vendorLabel = vendorList.find((v) => v.id === realVendorId)?.name ?? newVendorName ?? "Vendor"
        const amortRes = await fetch("/api/amortization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId,
            name: `${vendorLabel} — ${amortizeMonths}-month prepaid`,
            type: "PREPAID_EXPENSE",
            totalAmountCents: totalCents,
            startDate: date,
            months: Number(amortizeMonths),
            bsAccountId: prepaidAccountId,
            plAccountId: expenseAccountId,
          }),
        })
        if (!amortRes.ok) {
          const d = await amortRes.json()
          throw new Error(d.error || "Bill saved but amortization schedule failed — check Amortization page")
        }

        router.push(`/bills/${bill.id}`)
      } else {
        const res = await fetch("/api/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...billPayload,
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
      }
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Enter Bill</h1>

      {poPrefill && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-200 bg-green-50 text-green-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Matched to <strong>PO {poPrefill.poNumber ?? poPrefill.poId.slice(0, 8)}</strong> from {poPrefill.vendorName}. Lines pre-filled — review before saving.</span>
        </div>
      )}

      <ReceiptScanner onResult={handleScanResult} />

      {/* Receipt preview */}
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
            <a href={receiptLocalUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <ExternalLink className="w-3.5 h-3.5" />
              {receiptLocalIsPdf ? "Open PDF in new tab" : "View full size"}
            </a>
            {receiptUrl
              ? <p className="mt-1 text-xs text-green-600">✓ Saved to cloud — visible from bill detail after saving</p>
              : <p className="mt-1 text-xs text-gray-400">Preview only (cloud storage needs BLOB_READ_WRITE_TOKEN)</p>}
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
            : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <div>
            {scanBanner.allFilled ? (
              <span>
                {scanBanner.confidence === "high" ? "All fields filled" : "Fields pre-filled"}
                {scanBanner.vendorName && <> — <strong>{scanBanner.vendorName}</strong></>}
                {scanBanner.totalCents != null && <>, total <strong>${fmtCents(scanBanner.totalCents)}</strong></>}.
                {scanBanner.confidence !== "high" && <> <strong>Double-check before saving</strong> (confidence: {scanBanner.confidence}).</>}
                {" "}Review and save.
              </span>
            ) : (
              <span>
                <strong>Receipt scanned</strong>
                {scanBanner.totalCents != null && <> — total <strong>${fmtCents(scanBanner.totalCents)}</strong></>}.
                {scanBanner.vendorMissing
                  ? <> Vendor not found on document — enter it in the field above.</>
                  : scanBanner.vendorName
                    ? <> Vendor: <strong>{scanBanner.vendorName}</strong>.</>
                    : null}
                {" "}Check highlighted fields before saving.
                {scanBanner.confidence !== "high" && <> Confidence: <strong>{scanBanner.confidence}</strong>.</>}
              </span>
            )}
          </div>
          <button type="button" onClick={() => setScanBanner(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* _new_ sentinel notice — shown only when vendor creation was deferred to save */}
      {vendorId === "_new_" && newVendorName && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>New vendor <strong>{newVendorName}</strong> will be created when you save. Or select an existing vendor below.</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Header fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={label}>Vendor *</label>
            <div className="flex gap-2 items-center">
              <select
                value={vendorId === "_new_" ? "" : vendorId}
                onChange={(e) => {
                  setNewVendorName("")
                  setVendorId(e.target.value)
                }}
                className={`${input} flex-1`}
              >
                <option value="">Select existing…</option>
                {vendorList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <span className="text-gray-400 text-sm shrink-0">or</span>
              <input
                type="text"
                value={vendorId === "_new_" || !vendorId ? newVendorName : ""}
                onChange={(e) => {
                  const typed = e.target.value
                  setNewVendorName(typed)
                  setVendorId(typed ? "_new_" : "")
                }}
                disabled={!!(vendorId && vendorId !== "_new_")}
                placeholder="New vendor name…"
                className={`${input} flex-1 ${(vendorId && vendorId !== "_new_") ? "opacity-40 cursor-not-allowed bg-gray-50" : ""}`}
              />
            </div>
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

          {(isLikelyAnnualOrTermContract || doAmortize) && (
            <div className="col-span-2 rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={doAmortize}
                  onChange={(e) => {
                    setDoAmortize(e.target.checked)
                    if (e.target.checked && !prepaidAccountId && assetAccounts.length > 0) {
                      const prepaid = assetAccounts.find((a) => a.name.toLowerCase().includes("prepaid"))
                      setPrepaidAccountId(prepaid?.id ?? assetAccounts[0].id)
                    }
                  }}
                  className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-900">
                  Amortize over{" "}
                  <input
                    type="number"
                    min={1}
                    max={360}
                    value={amortizeMonths}
                    onChange={(e) => setAmortizeMonths(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block w-16 border border-indigo-300 rounded px-1.5 py-0.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mx-1"
                  />{" "}
                  months
                </span>
              </label>

              {doAmortize && (
                <>
                  {totalCents > 0 && Number(amortizeMonths) > 0 && (
                    <p className="text-xs text-indigo-700 ml-6">
                      Bill will post as <strong>DR Prepaid Asset / CR AP</strong> (${(totalCents / 100).toFixed(2)} total).
                      Monthly amortization will expense <strong>${(totalCents / Number(amortizeMonths) / 100).toFixed(2)}/month</strong> over {amortizeMonths} months.
                    </p>
                  )}
                  <div className="ml-6">
                    <label className="block text-xs font-medium text-indigo-800 mb-1">Prepaid Asset Account *</label>
                    {assetAccounts.length === 0 ? (
                      <p className="text-xs text-red-600">No asset accounts found — add a Prepaid Asset account in Chart of Accounts first.</p>
                    ) : (
                      <select
                        value={prepaidAccountId}
                        onChange={(e) => setPrepaidAccountId(e.target.value)}
                        className="border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[260px]"
                      >
                        <option value="">Select prepaid asset account…</option>
                        {assetAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
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
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : "Enter Bill"}
        </button>
        <p className="text-xs text-gray-400">
          {doAmortize
            ? `Posts DR Prepaid Asset / CR AP, then creates ${amortizeMonths}-month amortization schedule`
            : "Posts DR Expense / CR Accounts Payable immediately"}
        </p>
        <button type="button" onClick={() => router.back()} className="ml-auto px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
