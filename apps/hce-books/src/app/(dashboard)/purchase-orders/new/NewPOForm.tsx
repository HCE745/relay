"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

type Vendor = { id: string; name: string }
type Account = { id: string; code: string; name: string }

type Props = {
  entityId: string
  vendors: Vendor[]
  expenseAccounts: Account[]
}

type LineItem = {
  key: string
  description: string
  qty: string
  unitPrice: string
  accountId: string
}

let _k = 0
const newLine = (): LineItem => ({ key: String(++_k), description: "", qty: "1", unitPrice: "", accountId: "" })
function todayStr() { return new Date().toISOString().slice(0, 10) }
function dollarsToCents(s: string) { return Math.round((parseFloat(s) || 0) * 100) }
function fmtCents(c: number) { return (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }) }

const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

export function NewPOForm({ entityId, vendors, expenseAccounts }: Props) {
  const router = useRouter()
  const [vendorId, setVendorId] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [date, setDate] = useState(todayStr)
  const [expectedDate, setExpectedDate] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateLine(key: string, field: keyof LineItem, val: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)))
  }

  const totalCents = lines.reduce((s, l) => {
    const qty = parseFloat(l.qty) || 0
    return s + Math.round(qty * dollarsToCents(l.unitPrice))
  }, 0)

  async function handleSave() {
    if (!vendorId) { setError("Select a vendor"); return }
    if (lines.some((l) => !l.unitPrice || parseFloat(l.unitPrice) <= 0)) {
      setError("Enter unit price for all lines"); return
    }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          vendorId,
          poNumber: poNumber || undefined,
          date,
          expectedDate: expectedDate || undefined,
          notes: notes || undefined,
          lines: lines.map((l, i) => ({
            description: l.description || undefined,
            qty: parseFloat(l.qty) || 1,
            unitPriceCents: dollarsToCents(l.unitPrice),
            accountId: l.accountId || undefined,
            sortOrder: i,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create PO")
      router.push(`/purchase-orders/${data.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={input}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
            <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-0001 (auto-filled if blank)" className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={input} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Optional notes" className={input + " resize-none"} />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
          <button type="button" onClick={() => setLines((p) => [...p, newLine()])}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Add Line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Description</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-20">Qty</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-32">Unit Price</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Account</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-28">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const qty = parseFloat(line.qty) || 0
                const amt = Math.round(qty * dollarsToCents(line.unitPrice))
                return (
                  <tr key={line.key} className="border-b border-gray-100">
                    <td className="px-4 py-2">
                      <input type="text" value={line.description} placeholder="Description"
                        onChange={(e) => updateLine(line.key, "description", e.target.value)} className={input} />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" min="0" step="1" value={line.qty}
                        onChange={(e) => updateLine(line.key, "qty", e.target.value)} className={input} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" min="0" step="0.01" value={line.unitPrice} placeholder="0.00"
                          onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} className={`${input} pl-6`} />
                      </div>
                    </td>
                    <td className="px-4 py-2 min-w-[160px]">
                      <select value={line.accountId} onChange={(e) => updateLine(line.key, "accountId", e.target.value)} className={input}>
                        <option value="">— optional —</option>
                        {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-gray-900">${fmtCents(amt)}</td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => setLines((p) => p.length > 1 ? p.filter((l) => l.key !== line.key) : p)}
                        className="text-gray-300 hover:text-red-500 transition-colors">
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
          {saving ? "Creating…" : "Create Purchase Order"}
        </button>
        <p className="text-xs text-gray-400">No ledger entry is posted — POs are commitments only</p>
        <button type="button" onClick={() => router.back()}
          className="ml-auto px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
