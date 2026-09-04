"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

type Account = { id: string; code: string; name: string }
type Customer = { id: string; name: string }
type Klass = { id: string; name: string }
type Dept = { id: string; name: string }

export type InvoiceFormProps = {
  entityId: string
  customers: Customer[]
  revenueAccounts: Account[]
  classes: Klass[]
  departments: Dept[]
}

type LineItem = {
  key: string
  description: string
  accountId: string
  quantity: string
  unitPrice: string  // dollars
  classId: string
  departmentId: string
}

let _key = 0
function newLine(): LineItem {
  return { key: String(++_key), description: "", accountId: "", quantity: "1", unitPrice: "", classId: "", departmentId: "" }
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function plus30() {
  const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
}
function dollarsToCents(s: string) { return Math.round((parseFloat(s) || 0) * 100) }
function fmtCents(c: number) { return (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }) }

const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const label = "block text-sm font-medium text-gray-700 mb-1"

export function InvoiceForm({ entityId, customers, revenueAccounts, classes, departments }: InvoiceFormProps) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")
  const [date, setDate] = useState(todayStr)
  const [dueDate, setDueDate] = useState(plus30)
  const [memo, setMemo] = useState("")
  const [taxPct, setTaxPct] = useState("")
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateLine(key: string, field: keyof LineItem, val: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)))
  }
  function addLine() { setLines((p) => [...p, newLine()]) }
  function removeLine(key: string) {
    setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p))
  }

  const subtotalCents = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0
    return s + Math.round(qty * dollarsToCents(l.unitPrice))
  }, 0)
  const taxDecimal = (parseFloat(taxPct) || 0) / 100
  const taxCents = Math.round(subtotalCents * taxDecimal)
  const totalCents = subtotalCents + taxCents

  async function handleSave() {
    if (!customerId) { setError("Select a customer"); return }
    if (lines.some((l) => !l.accountId)) { setError("Select a revenue account for every line item"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          customerId,
          date,
          dueDate,
          memo: memo || undefined,
          taxRate: taxDecimal || undefined,
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
      const inv = await res.json()
      router.push(`/invoices/${inv.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={label}>Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={input}>
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Memo</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional note" className={input} />
          </div>
          <div>
            <label className={label}>Invoice Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Due Date *</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={input} />
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
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Revenue Account *</th>
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
                return (
                  <tr key={line.key} className="border-b border-gray-100">
                    <td className="px-4 py-2">
                      <input type="text" value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} placeholder="Description" className={input} />
                    </td>
                    <td className="px-4 py-2 min-w-[180px]">
                      <select value={line.accountId} onChange={(e) => updateLine(line.key, "accountId", e.target.value)} className={input}>
                        <option value="">Select…</option>
                        {revenueAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
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
                    <td className="px-4 py-2 text-right font-mono text-sm text-gray-900">
                      ${fmtCents(lineCents)}
                    </td>
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

        {/* Totals */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-col items-end gap-2 text-sm">
          <div className="flex items-center gap-8">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-mono w-28 text-right">${fmtCents(subtotalCents)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-500">Tax Rate</span>
            <div className="relative w-24">
              <input type="number" min="0" max="100" step="0.1" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm pr-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
            </div>
            <span className="font-mono w-28 text-right">${fmtCents(taxCents)}</span>
          </div>
          <div className="flex items-center gap-8 border-t border-gray-200 pt-2 font-semibold text-base">
            <span>Total</span>
            <span className="font-mono w-28 text-right">${fmtCents(totalCents)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : "Save as Draft"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
