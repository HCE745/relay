"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

type Account = { id: string; code: string; name: string; type: string }

type Props = {
  entityId: string
  accounts: Account[]
}

type AmortizationType = "PREPAID_EXPENSE" | "DEFERRED_REVENUE"

function todayStr() { return new Date().toISOString().slice(0, 10) }
function dollarsToCents(s: string) { return Math.round((parseFloat(s) || 0) * 100) }
function fmtCents(c: number) { return (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }) }

const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const lbl = "block text-sm font-medium text-gray-700 mb-1"

export function NewAmortizationForm({ entityId, accounts }: Props) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [type, setType] = useState<AmortizationType>("PREPAID_EXPENSE")
  const [totalAmount, setTotalAmount] = useState("")
  const [startDate, setStartDate] = useState(todayStr)
  const [months, setMonths] = useState("12")
  const [bsAccountId, setBsAccountId] = useState("")
  const [plAccountId, setPlAccountId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const totalCents = dollarsToCents(totalAmount)
  const monthCount = parseInt(months) || 0
  const monthlyAmount = monthCount > 0 ? Math.floor(totalCents / monthCount) : 0
  const lastMonthAmount = monthCount > 0 ? totalCents - monthlyAmount * (monthCount - 1) : 0

  const bsLabel = type === "PREPAID_EXPENSE" ? "Prepaid Asset (Balance Sheet) *" : "Deferred Revenue Liability (Balance Sheet) *"
  const plLabel = type === "PREPAID_EXPENSE" ? "Expense Account (P&L) *" : "Revenue Account (P&L) *"

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return }
    if (!totalAmount || totalCents <= 0) { setError("Total amount must be positive"); return }
    if (!monthCount || monthCount <= 0) { setError("Months must be a positive number"); return }
    if (!bsAccountId) { setError("Balance sheet account is required"); return }
    if (!plAccountId) { setError("P&L account is required"); return }

    setSaving(true); setError("")
    try {
      const res = await fetch("/api/amortization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          name: name.trim(),
          type,
          totalAmountCents: totalCents,
          startDate,
          months: monthCount,
          bsAccountId,
          plAccountId,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save") }
      router.push("/amortization")
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>Schedule Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prepaid Insurance 2026" className={input} />
          </div>
          <div>
            <label className={lbl}>Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value as AmortizationType)} className={input}>
              <option value="PREPAID_EXPENSE">Prepaid Expense</option>
              <option value="DEFERRED_REVENUE">Deferred Revenue</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Total Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className={`${input} pl-6`}
              />
            </div>
          </div>
          <div>
            <label className={lbl}>Start Date *</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className={lbl}>Number of Months *</label>
            <input
              type="number"
              min="1"
              step="1"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={lbl}>{bsLabel}</label>
            <select value={bsAccountId} onChange={(e) => setBsAccountId(e.target.value)} className={input}>
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>{plLabel}</label>
            <select value={plAccountId} onChange={(e) => setPlAccountId(e.target.value)} className={input}>
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </select>
          </div>
        </div>

        {/* Preview */}
        {totalCents > 0 && monthCount > 0 && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Monthly Breakdown Preview</p>
            <div className="flex gap-8 text-gray-600">
              <span>Per month: <span className="font-mono font-medium text-gray-900">${fmtCents(monthlyAmount)}</span></span>
              <span>Last month: <span className="font-mono font-medium text-gray-900">${fmtCents(lastMonthAmount)}</span></span>
              <span>Total: <span className="font-mono font-medium text-gray-900">${fmtCents(totalCents)}</span></span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Creating…" : "Create Schedule"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  )
}
