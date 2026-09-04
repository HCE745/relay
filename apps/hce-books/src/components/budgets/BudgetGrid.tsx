"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Save, Upload } from "lucide-react"

type Account = { id: string; code: string; name: string; type: string }

type Props = {
  budgetId: string
  periodType: "MONTHLY" | "QUARTERLY" | "ANNUAL"
  accounts: Account[]
}

function getPeriodLabels(periodType: Props["periodType"]): string[] {
  if (periodType === "MONTHLY") {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  }
  if (periodType === "QUARTERLY") {
    return ["Q1", "Q2", "Q3", "Q4"]
  }
  return ["Annual"]
}

type GridState = Record<string, Record<number, string>> // accountId -> period -> displayValue

export function BudgetGrid({ budgetId, periodType, accounts }: Props) {
  const periodLabels = getPeriodLabels(periodType)
  const periodCount = periodLabels.length

  const [grid, setGrid] = useState<GridState>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load existing lines
  useEffect(() => {
    fetch(`/api/budgets/${budgetId}/lines`)
      .then((r) => r.json())
      .then((lines: { accountId: string; period: number; amountCents: number }[]) => {
        const state: GridState = {}
        for (const line of lines) {
          if (!state[line.accountId]) state[line.accountId] = {}
          state[line.accountId][line.period] = (line.amountCents / 100).toFixed(2)
        }
        setGrid(state)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [budgetId])

  const handleCellChange = useCallback((accountId: string, period: number, value: string) => {
    setGrid((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] ?? {}), [period]: value },
    }))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const lines: { accountId: string; period: number; amountCents: number }[] = []
      for (const account of accounts) {
        for (let p = 1; p <= periodCount; p++) {
          const raw = grid[account.id]?.[p] ?? ""
          const dollars = parseFloat(raw)
          const amountCents = isNaN(dollars) ? 0 : Math.round(dollars * 100)
          lines.push({ accountId: account.id, period: p, amountCents })
        }
      }
      const res = await fetch(`/api/budgets/${budgetId}/lines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaveMsg("Saved successfully")
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setSaveMsg("Error saving — please try again")
    } finally {
      setSaving(false)
    }
  }

  function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const rows = text.trim().split("\n")
      if (rows.length < 2) return
      const header = rows[0].split(",").map((h) => h.trim().toLowerCase())
      const codeIdx = header.indexOf("account_code")
      const periodIdx = header.indexOf("period")
      const amountIdx = header.indexOf("amount")
      if (codeIdx === -1 || periodIdx === -1 || amountIdx === -1) {
        alert("CSV must have columns: account_code, period, amount")
        return
      }

      const newGrid: GridState = { ...grid }
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
        const code = cols[codeIdx]
        const periodRaw = cols[periodIdx]
        const amount = parseFloat(cols[amountIdx])
        if (!code || isNaN(amount)) continue

        const account = accounts.find((a) => a.code === code)
        if (!account) continue

        // Period can be a number (1-based) or a label like "Jan", "Q1", etc.
        let period = parseInt(periodRaw)
        if (isNaN(period)) {
          const idx = periodLabels.findIndex((l) => l.toLowerCase() === periodRaw.toLowerCase())
          period = idx >= 0 ? idx + 1 : -1
        }
        if (period < 1 || period > periodCount) continue

        if (!newGrid[account.id]) newGrid[account.id] = {}
        newGrid[account.id][period] = amount.toFixed(2)
      }
      setGrid(newGrid)
    }
    reader.readAsText(file)
    // Reset input so same file can be re-imported
    e.target.value = ""
  }

  const incomeAccounts = accounts.filter((a) => a.type === "INCOME")
  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE")

  if (loading) {
    return <div className="py-12 text-center text-gray-400 text-sm">Loading budget data...</div>
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
        {saveMsg && (
          <span className={`text-sm font-medium ${saveMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[280px]">
                Account
              </th>
              {periodLabels.map((label) => (
                <th key={label} className="text-right px-3 py-3 font-semibold text-gray-700 min-w-[110px]">
                  {label}
                </th>
              ))}
              <th className="text-right px-4 py-3 font-semibold text-gray-700 min-w-[120px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Income section */}
            {incomeAccounts.length > 0 && (
              <>
                <tr className="bg-blue-50">
                  <td
                    colSpan={periodCount + 2}
                    className="px-4 py-2 text-xs font-semibold text-blue-700 uppercase tracking-wider"
                  >
                    Income
                  </td>
                </tr>
                {incomeAccounts.map((account) => (
                  <GridRow
                    key={account.id}
                    account={account}
                    periodCount={periodCount}
                    grid={grid}
                    onChange={handleCellChange}
                  />
                ))}
              </>
            )}

            {/* Expense section */}
            {expenseAccounts.length > 0 && (
              <>
                <tr className="bg-orange-50">
                  <td
                    colSpan={periodCount + 2}
                    className="px-4 py-2 text-xs font-semibold text-orange-700 uppercase tracking-wider"
                  >
                    Expenses
                  </td>
                </tr>
                {expenseAccounts.map((account) => (
                  <GridRow
                    key={account.id}
                    account={account}
                    periodCount={periodCount}
                    grid={grid}
                    onChange={handleCellChange}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Tip: Import CSV with columns <code className="font-mono">account_code,period,amount</code>. Period can be a
        number (1–{periodCount}) or label ({periodLabels.join(", ")}).
      </p>
    </div>
  )
}

function GridRow({
  account,
  periodCount,
  grid,
  onChange,
}: {
  account: Account
  periodCount: number
  grid: GridState
  onChange: (accountId: string, period: number, value: string) => void
}) {
  const inputClass =
    "w-full text-right border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"

  let rowTotal = 0
  for (let p = 1; p <= periodCount; p++) {
    const raw = grid[account.id]?.[p] ?? ""
    const val = parseFloat(raw)
    if (!isNaN(val)) rowTotal += val
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-1.5 sticky left-0 bg-white hover:bg-gray-50">
        <span className="font-mono text-xs text-gray-400 mr-2">{account.code}</span>
        <span className="text-gray-800">{account.name}</span>
      </td>
      {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
        <td key={p} className="px-1 py-1">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            placeholder="0.00"
            value={grid[account.id]?.[p] ?? ""}
            onChange={(e) => onChange(account.id, p, e.target.value)}
          />
        </td>
      ))}
      <td className="px-4 py-1.5 text-right font-mono text-gray-700 font-medium">
        {rowTotal.toFixed(2)}
      </td>
    </tr>
  )
}
