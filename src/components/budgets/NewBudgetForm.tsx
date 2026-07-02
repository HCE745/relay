"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

type Props = {
  entityId: string
  defaultYear: number
}

export function NewBudgetForm({ entityId, defaultYear }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    fiscalYear: defaultYear,
    periodType: "MONTHLY" as "MONTHLY" | "QUARTERLY" | "ANNUAL",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, entityId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create budget")
      }
      const budget = await res.json()
      router.push(`/budgets/${budget.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setSaving(false)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Budget Name</label>
        <input
          type="text"
          className={inputClass}
          placeholder="e.g. FY2026 Operating Budget"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
        <input
          type="number"
          className={inputClass}
          value={form.fiscalYear}
          min={2000}
          max={2100}
          onChange={(e) => setForm((f) => ({ ...f, fiscalYear: Number(e.target.value) }))}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
        <select
          className={inputClass}
          value={form.periodType}
          onChange={(e) => setForm((f) => ({ ...f, periodType: e.target.value as typeof form.periodType }))}
        >
          <option value="MONTHLY">Monthly (12 periods)</option>
          <option value="QUARTERLY">Quarterly (4 periods)</option>
          <option value="ANNUAL">Annual (1 period)</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Budget"}
        </button>
        <a href="/budgets" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
          Cancel
        </a>
      </div>
    </form>
  )
}
