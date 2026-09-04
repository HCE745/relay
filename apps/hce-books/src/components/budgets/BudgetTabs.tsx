"use client"
import { useState } from "react"
import { BudgetGrid } from "./BudgetGrid"
import { VarianceReport } from "./VarianceReport"

type Account = { id: string; code: string; name: string; type: string }

type Props = {
  budgetId: string
  fiscalYear: number
  periodType: "MONTHLY" | "QUARTERLY" | "ANNUAL"
  accounts: Account[]
  isConsolidationParent: boolean
}

function getPeriodCount(periodType: Props["periodType"]) {
  if (periodType === "MONTHLY") return 12
  if (periodType === "QUARTERLY") return 4
  return 1
}

export function BudgetTabs({ budgetId, periodType, accounts, isConsolidationParent }: Props) {
  const [tab, setTab] = useState<"grid" | "variance">("grid")
  const totalPeriods = getPeriodCount(periodType)

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("grid")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "grid"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Enter Budget
        </button>
        <button
          onClick={() => setTab("variance")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "variance"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Variance Report
        </button>
      </div>

      {/* Tab content */}
      {tab === "grid" && (
        <BudgetGrid budgetId={budgetId} periodType={periodType} accounts={accounts} />
      )}
      {tab === "variance" && (
        <VarianceReport
          budgetId={budgetId}
          totalPeriods={totalPeriods}
          isConsolidationParent={isConsolidationParent}
        />
      )}
    </div>
  )
}
