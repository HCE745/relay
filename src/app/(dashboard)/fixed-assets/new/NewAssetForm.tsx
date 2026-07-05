"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

type Account = { id: string; code: string; name: string }

type Props = {
  entityId: string
  assetAccounts: Account[]
  accumDepAccounts: Account[]
  expenseAccounts: Account[]
  sourceAccounts: Account[]
  gainLossAccounts: Account[]
  defaults: {
    assetAccountId: string
    accumulatedDepreciationAccountId: string
    depreciationExpenseAccountId: string
    gainLossAccountId: string
    sourceAccountId: string
  }
}

const CATEGORIES = [
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "COMPUTER", label: "Computer" },
  { value: "BUILDING", label: "Building" },
  { value: "OTHER", label: "Other" },
]

function todayStr() { return new Date().toISOString().slice(0, 10) }
function dollarsToCents(s: string) { return Math.round((parseFloat(s) || 0) * 100) }

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

export function NewAssetForm({ entityId, assetAccounts, accumDepAccounts, expenseAccounts, sourceAccounts, gainLossAccounts, defaults }: Props) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("EQUIPMENT")
  const [acquisitionDate, setAcquisitionDate] = useState(todayStr)
  const [inServiceDate, setInServiceDate] = useState(todayStr)
  const [cost, setCost] = useState("")
  const [salvage, setSalvage] = useState("0")
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60")
  const [assetAccountId, setAssetAccountId] = useState(defaults.assetAccountId)
  const [accumDepAccountId, setAccumDepAccountId] = useState(defaults.accumulatedDepreciationAccountId)
  const [depExpAccountId, setDepExpAccountId] = useState(defaults.depreciationExpenseAccountId)
  const [sourceAccountId, setSourceAccountId] = useState(defaults.sourceAccountId)
  const [gainLossAccountId, setGainLossAccountId] = useState(defaults.gainLossAccountId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const costCents = dollarsToCents(cost)
  const salvageCents = dollarsToCents(salvage)
  const depreciableAmount = Math.max(0, costCents - salvageCents)
  const months = parseInt(usefulLifeMonths) || 1
  const monthlyDep = months > 0 ? Math.floor(depreciableAmount / months) / 100 : 0

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return }
    if (costCents <= 0) { setError("Cost must be greater than 0"); return }
    if (!assetAccountId || !accumDepAccountId || !depExpAccountId || !sourceAccountId) {
      setError("All account fields are required"); return
    }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          acquisitionDate,
          inServiceDate,
          costCents,
          salvageValueCents: salvageCents,
          usefulLifeMonths: months,
          depreciationMethod: "STRAIGHT_LINE",
          assetAccountId,
          accumulatedDepreciationAccountId: accumDepAccountId,
          depreciationExpenseAccountId: depExpAccountId,
          sourceAccountId,
          gainLossAccountId: gainLossAccountId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create asset")
      router.push(`/fixed-assets/${data.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Fixed Asset</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Asset Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Laser Printer, Company Van" className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Date *</label>
            <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">In-Service Date *</label>
            <input type="date" value={inServiceDate} onChange={(e) => setInServiceDate(e.target.value)} className={inp} />
          </div>
        </div>
      </div>

      {/* Depreciation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Depreciation</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)}
                placeholder="0.00" className={`${inp} pl-6`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salvage Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={salvage} onChange={(e) => setSalvage(e.target.value)}
                placeholder="0.00" className={`${inp} pl-6`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Useful Life (months) *</label>
            <input type="number" min="1" step="1" value={usefulLifeMonths}
              onChange={(e) => setUsefulLifeMonths(e.target.value)} className={inp} />
          </div>
        </div>
        {costCents > 0 && months > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            Monthly depreciation (straight-line): <strong>${monthlyDep.toFixed(2)}</strong> for {months} months
            {" "}= depreciable amount{" "}
            <strong>${(depreciableAmount / 100).toFixed(2)}</strong>
          </div>
        )}
      </div>

      {/* Accounts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Accounts</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Asset Account *</label>
            <select value={assetAccountId} onChange={(e) => setAssetAccountId(e.target.value)} className={inp}>
              <option value="">Select…</option>
              {assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accumulated Depreciation Account *</label>
            <select value={accumDepAccountId} onChange={(e) => setAccumDepAccountId(e.target.value)} className={inp}>
              <option value="">Select…</option>
              {accumDepAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Expense Account *</label>
            <select value={depExpAccountId} onChange={(e) => setDepExpAccountId(e.target.value)} className={inp}>
              <option value="">Select…</option>
              {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Account (paid from) *</label>
            <select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} className={inp}>
              <option value="">Select…</option>
              {sourceAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gain/Loss on Disposal Account</label>
            <select value={gainLossAccountId} onChange={(e) => setGainLossAccountId(e.target.value)} className={inp}>
              <option value="">Select…</option>
              {gainLossAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Creating…" : "Create Asset"}
        </button>
        <p className="text-xs text-gray-400">Acquisition posts DR Fixed Asset / CR Source immediately</p>
        <button type="button" onClick={() => router.back()}
          className="ml-auto px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
