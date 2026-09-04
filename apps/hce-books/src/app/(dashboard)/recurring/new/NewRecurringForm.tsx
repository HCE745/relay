"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

type Account = { id: string; code: string; name: string; type: string }
type Vendor = { id: string; name: string }
type Customer = { id: string; name: string }

type Props = {
  entityId: string
  vendors: Vendor[]
  customers: Customer[]
  accounts: Account[]
}

type LineItem = {
  key: string
  accountId: string
  description: string
  amount: string
  debit: string
  credit: string
}

let _key = 0
function newLine(): LineItem {
  return { key: String(++_key), accountId: "", description: "", amount: "", debit: "", credit: "" }
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function dollarsToCents(s: string) { return Math.round((parseFloat(s) || 0) * 100) }

const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const lbl = "block text-sm font-medium text-gray-700 mb-1"

type RecurringType = "BILL" | "INVOICE" | "JOURNAL"
type RecurringFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL"

export function NewRecurringForm({ entityId, vendors, customers, accounts }: Props) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [type, setType] = useState<RecurringType>("JOURNAL")
  const [frequency, setFrequency] = useState<RecurringFrequency>("MONTHLY")
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState("")
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "")
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")
  const [apAccountId, setApAccountId] = useState("")
  const [arAccountId, setArAccountId] = useState("")
  const [memo, setMemo] = useState("")
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateLine(key: string, field: keyof LineItem, val: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)))
  }

  function buildPayload() {
    const builtLines = lines.map((l) => {
      const base = { accountId: l.accountId, description: l.description || undefined }
      if (type === "JOURNAL") {
        return {
          ...base,
          debit: l.debit ? dollarsToCents(l.debit) : undefined,
          credit: l.credit ? dollarsToCents(l.credit) : undefined,
        }
      }
      return { ...base, amount: dollarsToCents(l.amount) }
    })

    const payload: Record<string, unknown> = { lines: builtLines, memo: memo || undefined }
    if (type === "BILL") { payload.vendorId = vendorId; payload.apAccountId = apAccountId }
    if (type === "INVOICE") { payload.customerId = customerId; payload.arAccountId = arAccountId }
    return payload
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return }
    if (lines.some((l) => !l.accountId)) { setError("Select an account for every line"); return }
    if (type === "BILL" && !apAccountId) { setError("AP Account is required"); return }
    if (type === "INVOICE" && !arAccountId) { setError("AR Account is required"); return }

    setSaving(true); setError("")
    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          name: name.trim(),
          type,
          frequency,
          startDate,
          endDate: endDate || undefined,
          payload: buildPayload(),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save") }
      router.push("/recurring")
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const apAccounts = accounts.filter((a) => a.type === "LIABILITY")
  const arAccounts = accounts.filter((a) => a.type === "ASSET")

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Template Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>Template Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Rent" className={input} />
          </div>
          <div>
            <label className={lbl}>Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value as RecurringType)} className={input}>
              <option value="BILL">Bill</option>
              <option value="INVOICE">Invoice</option>
              <option value="JOURNAL">Journal Entry</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Frequency *</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} className={input}>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Start Date *</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className={lbl}>End Date (optional)</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Memo</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional memo for generated entries" className={input} />
          </div>
        </div>
      </div>

      {/* Type-specific fields */}
      {type === "BILL" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Bill Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Vendor *</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={input}>
                <option value="">Select vendor…</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>AP Account *</label>
              <select value={apAccountId} onChange={(e) => setApAccountId(e.target.value)} className={input}>
                <option value="">Select AP account…</option>
                {apAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {type === "INVOICE" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Invoice Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Customer *</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={input}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>AR Account *</label>
              <select value={arAccountId} onChange={(e) => setArAccountId(e.target.value)} className={input}>
                <option value="">Select AR account…</option>
                {arAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
          <button type="button" onClick={() => setLines((p) => [...p, newLine()])} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Add Line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Account *</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Description</th>
                {type === "JOURNAL" ? (
                  <>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-32">Debit ($)</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-32">Credit ($)</th>
                  </>
                ) : (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-32">Amount ($)</th>
                )}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b border-gray-100">
                  <td className="px-4 py-2 min-w-[200px]">
                    <select value={line.accountId} onChange={(e) => updateLine(line.key, "accountId", e.target.value)} className={input}>
                      <option value="">Select…</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} placeholder="Description" className={input} />
                  </td>
                  {type === "JOURNAL" ? (
                    <>
                      <td className="px-4 py-2">
                        <input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(line.key, "debit", e.target.value)} placeholder="0.00" className={input} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(line.key, "credit", e.target.value)} placeholder="0.00" className={input} />
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-2">
                      <input type="number" min="0" step="0.01" value={line.amount} onChange={(e) => updateLine(line.key, "amount", e.target.value)} placeholder="0.00" className={input} />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => setLines((p) => p.length > 1 ? p.filter((l) => l.key !== line.key) : p)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving…" : "Create Template"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  )
}
