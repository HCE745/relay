"use client"
import { useState, useEffect, useCallback } from "react"
import { Loader2, Sparkles, Trash2, Save, ChevronDown, ChevronUp, Calculator, Plus, Check } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioType = "HIRING" | "EQUIPMENT" | "DEBT"

type BeforeSnapshot = {
  cashCents: number
  monthlyExpensesCents: number
  monthlyRevenueCents: number
  monthlyBurnCents: number
  runwayMonths: number | null
  recommendedReserveCents: number
}

type HiringResult = {
  type: "HIRING"
  before: BeforeSnapshot
  after: {
    cashCents: number
    monthlyCostCents: number
    monthlyBurnCents: number
    runwayMonths: number | null
    cashAfterOneMonth: number
    cashAfterThreeMonths: number
    cashAfterTwelveMonths: number
  }
  math: {
    annualSalaryCents: number
    baseMonthlyCents: number
    benefitsPct: number
    fullyLoadedMonthlyCents: number
    oneTimeCostsCents: number
    newMonthlyBurnCents: number
    breakevenRevenueNeededCents: number | null
    runwayDeltaMonths: number | null
  }
  aiSummary?: string | null
}

type EquipmentResult = {
  type: "EQUIPMENT"
  before: BeforeSnapshot
  cashScenario: {
    upfrontCashCents: number
    cashAfterPurchase: number
    runwayMonths: number | null
  }
  financeScenario: {
    downPaymentCents: number
    principalCents: number
    monthlyPaymentCents: number
    totalInterestCents: number
    totalCostCents: number
    cashAfterDown: number
    monthlyBurnCents: number
    runwayMonths: number | null
  } | null
  depreciation: { usefulLifeMonths: number; monthlyDepreciationCents: number; annualDepreciationCents: number }
  inputs: { costCents: number; isFinanced: boolean }
  aiSummary?: string | null
}

type DebtResult = {
  type: "DEBT"
  before: BeforeSnapshot
  after: {
    loanProceedsCents: number
    cashAfterFunding: number
    monthlyPaymentCents: number
    totalInterestCents: number
    totalCostCents: number
    newMonthlyBurnCents: number
    runwayMonths: number | null
  }
  aiSummary?: string | null
}

type ComputeResult = HiringResult | EquipmentResult | DebtResult

type SavedScenario = {
  id: string
  name: string
  type: ScenarioType
  inputs: Record<string, unknown>
  result: ComputeResult
  aiSummary?: string | null
  notes?: string | null
  createdAt: string
}

type Props = { entityId: string }

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}
function fmtSigned(cents: number): string {
  return cents < 0 ? `(${fmt(cents)})` : fmt(cents)
}

function DeltaBadge({ delta, invertColor = false }: { delta: number | null; invertColor?: boolean }) {
  if (delta === null) return <span className="text-gray-300">—</span>
  const positive = invertColor ? delta <= 0 : delta >= 0
  return (
    <span className={`text-xs font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
      {delta >= 0 ? "+" : ""}{fmt(delta)}
    </span>
  )
}

// ─── Before/After comparison table ───────────────────────────────────────────

function CompareRow({ label, before, after, isCents = true, invertGood = false, isRunway = false }: {
  label: string; before: number | null; after: number | null; isCents?: boolean; invertGood?: boolean; isRunway?: boolean
}) {
  const delta = before !== null && after !== null ? after - before : null
  const positive = delta !== null ? (invertGood ? delta <= 0 : delta >= 0) : null
  const fmt2 = isCents ? fmt : (n: number) => `${n.toFixed(1)} mo`

  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 pr-4 text-sm text-gray-600 whitespace-nowrap">{label}</td>
      <td className="py-2 pr-4 text-sm font-mono text-gray-800 text-right">{before !== null ? (isRunway ? `${(before as number).toFixed(1)} mo` : fmt(before)) : "—"}</td>
      <td className="py-2 pr-4 text-sm font-mono font-semibold text-gray-900 text-right">{after !== null ? (isRunway ? `${(after as number).toFixed(1)} mo` : fmt(after)) : "—"}</td>
      <td className="py-2 text-right text-sm">
        {delta !== null && (
          <span className={`font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
            {delta >= 0 && isCents ? "+" : delta < 0 && isCents ? "(" : ""}{isCents ? fmt(Math.abs(delta)) : (delta >= 0 ? "+" : "") + delta.toFixed(1) + " mo"}{delta < 0 && isCents ? ")" : ""}
          </span>
        )}
      </td>
    </tr>
  )
}

// ─── Hiring form & result ─────────────────────────────────────────────────────

function HiringForm({ entityId, onResult }: { entityId: string; onResult: (r: HiringResult, inputs: Record<string, unknown>) => void }) {
  const [annualSalary, setAnnualSalary] = useState("")
  const [benefits, setBenefits] = useState("25")
  const [oneTime, setOneTime] = useState("0")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [withAI, setWithAI] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function compute() {
    const salary = parseFloat(annualSalary.replace(/[^0-9.]/g, ""))
    if (!salary || salary <= 0) { setError("Enter a valid salary"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/scenarios/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "HIRING", entityId, withAI,
          inputs: {
            annualSalaryCents: Math.round(salary * 100),
            benefitsPct: parseFloat(benefits),
            oneTimeCostsCents: Math.round(parseFloat(oneTime || "0") * 100),
            startDate,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onResult(json as HiringResult, json.inputs)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Annual Salary ($)</label>
          <input type="text" value={annualSalary} onChange={(e) => setAnnualSalary(e.target.value)}
            placeholder="e.g. 60000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Benefits & Taxes (%)</label>
          <input type="number" value={benefits} onChange={(e) => setBenefits(e.target.value)}
            min="0" max="100" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">One-time Costs (recruiting, equipment) ($)</label>
          <input type="text" value={oneTime} onChange={(e) => setOneTime(e.target.value)}
            placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" checked={withAI} onChange={(e) => setWithAI(e.target.checked)} className="rounded border-gray-300 text-purple-600" />
        Include AI summary
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={compute} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
        Compute
      </button>
    </div>
  )
}

function HiringResultView({ result }: { result: HiringResult }) {
  const { before, after, math } = result
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase">
              <th className="text-left pb-2">Metric</th>
              <th className="text-right pb-2">Before</th>
              <th className="text-right pb-2">After</th>
              <th className="text-right pb-2">Change</th>
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Cash" before={before.cashCents} after={after.cashCents} />
            <CompareRow label="Monthly burn" before={before.monthlyBurnCents} after={after.monthlyBurnCents} invertGood />
            <CompareRow label="Runway" before={before.runwayMonths} after={after.runwayMonths} isCents={false} isRunway />
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fully-Loaded Cost Breakdown</p>
        <div className="flex justify-between"><span className="text-gray-600">Annual salary</span><span className="font-mono">{fmt(math.annualSalaryCents)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Monthly base (÷12)</span><span className="font-mono">{fmt(math.baseMonthlyCents)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Benefits & taxes (+{math.benefitsPct}%)</span><span className="font-mono">{fmt(math.fullyLoadedMonthlyCents - math.baseMonthlyCents)}</span></div>
        <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5"><span>Fully-loaded monthly</span><span className="font-mono">{fmt(math.fullyLoadedMonthlyCents)}</span></div>
        {math.oneTimeCostsCents > 0 && (
          <div className="flex justify-between"><span className="text-gray-600">One-time costs</span><span className="font-mono text-red-600">({fmt(math.oneTimeCostsCents)})</span></div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        {[
          { label: "Cash after 1 mo", val: after.cashAfterOneMonth },
          { label: "Cash after 3 mo", val: after.cashAfterThreeMonths },
          { label: "Cash after 12 mo", val: after.cashAfterTwelveMonths },
        ].map(({ label, val }) => (
          <div key={label} className={`rounded-lg border p-3 ${val < before.recommendedReserveCents ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`font-mono font-semibold mt-0.5 ${val < 0 ? "text-red-700" : val < before.recommendedReserveCents ? "text-orange-600" : "text-gray-900"}`}>{fmt(val)}</p>
            {val < before.recommendedReserveCents && <p className="text-xs text-red-500 mt-0.5">Below reserve</p>}
          </div>
        ))}
      </div>
      {math.breakevenRevenueNeededCents && (
        <p className="text-xs text-gray-500">Breakeven: requires <span className="font-medium">{fmt(math.breakevenRevenueNeededCents)}/mo</span> additional revenue to cover this hire at current margins.</p>
      )}
    </div>
  )
}

// ─── Equipment form & result ──────────────────────────────────────────────────

function EquipmentForm({ entityId, onResult }: { entityId: string; onResult: (r: EquipmentResult, inputs: Record<string, unknown>) => void }) {
  const [cost, setCost] = useState("")
  const [isFinanced, setIsFinanced] = useState(false)
  const [downPayment, setDownPayment] = useState("0")
  const [term, setTerm] = useState("60")
  const [rate, setRate] = useState("6")
  const [life, setLife] = useState("60")
  const [withAI, setWithAI] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function compute() {
    const c = parseFloat(cost.replace(/[^0-9.]/g, ""))
    if (!c || c <= 0) { setError("Enter a valid cost"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/scenarios/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "EQUIPMENT", entityId, withAI,
          inputs: {
            costCents: Math.round(c * 100),
            isFinanced,
            downPaymentCents: isFinanced ? Math.round(parseFloat(downPayment || "0") * 100) : 0,
            loanTermMonths: parseInt(term),
            annualRatePct: parseFloat(rate),
            usefulLifeMonths: parseInt(life),
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onResult(json as EquipmentResult, json.inputs)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Equipment Cost ($)</label>
          <input type="text" value={cost} onChange={(e) => setCost(e.target.value)}
            placeholder="e.g. 25000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Useful Life (months)</label>
          <input type="number" value={life} onChange={(e) => setLife(e.target.value)}
            min="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={isFinanced} onChange={(e) => setIsFinanced(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
            Finance this purchase
          </label>
        </div>
        {isFinanced && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Down Payment ($)</label>
              <input type="text" value={downPayment} onChange={(e) => setDownPayment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Loan Term (months)</label>
              <input type="number" value={term} onChange={(e) => setTerm(e.target.value)}
                min="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Annual Interest Rate (%)</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
                min="0" step="0.1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" checked={withAI} onChange={(e) => setWithAI(e.target.checked)} className="rounded border-gray-300 text-purple-600" />
        Include AI summary
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={compute} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
        Compute
      </button>
    </div>
  )
}

function EquipmentResultView({ result }: { result: EquipmentResult }) {
  const { before, cashScenario, financeScenario, depreciation, inputs } = result
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Cash scenario */}
        <div className={`rounded-xl border p-4 ${cashScenario.cashAfterPurchase < before.recommendedReserveCents ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Cash Purchase</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Cost</span><span className="font-mono text-red-600">({fmt(inputs.costCents)})</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cash remaining</span><span className="font-mono font-semibold">{fmt(cashScenario.cashAfterPurchase)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Runway</span><span className="font-mono">{cashScenario.runwayMonths?.toFixed(1) ?? "—"} mo</span></div>
          </div>
        </div>

        {/* Finance scenario */}
        {financeScenario && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Financed</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Down payment</span><span className="font-mono text-red-600">({fmt(financeScenario.downPaymentCents)})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Monthly payment</span><span className="font-mono text-red-600">({fmt(financeScenario.monthlyPaymentCents)})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total interest</span><span className="font-mono text-orange-600">{fmt(financeScenario.totalInterestCents)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">All-in cost</span><span className="font-mono font-semibold">{fmt(financeScenario.totalCostCents)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Runway</span><span className="font-mono">{financeScenario.runwayMonths?.toFixed(1) ?? "—"} mo</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Depreciation (Straight-Line)</p>
        <div className="flex gap-6">
          <span className="text-gray-600">Monthly: <span className="font-mono font-semibold">{fmt(depreciation.monthlyDepreciationCents)}</span></span>
          <span className="text-gray-600">Annual: <span className="font-mono font-semibold">{fmt(depreciation.annualDepreciationCents)}</span></span>
          <span className="text-gray-600">Over: <span className="font-semibold">{depreciation.usefulLifeMonths} months</span></span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Recording this purchase creates a fixed asset. Use the <a href="/fixed-assets/new" className="text-blue-600 hover:underline">Fixed Assets module</a> to post acquisition and schedule depreciation.</p>
      </div>
    </div>
  )
}

// ─── Debt form & result ───────────────────────────────────────────────────────

function DebtForm({ entityId, onResult }: { entityId: string; onResult: (r: DebtResult, inputs: Record<string, unknown>) => void }) {
  const [principal, setPrincipal] = useState("")
  const [rate, setRate] = useState("7")
  const [termMonths, setTermMonths] = useState("60")
  const [withAI, setWithAI] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function compute() {
    const p = parseFloat(principal.replace(/[^0-9.]/g, ""))
    if (!p || p <= 0) { setError("Enter a valid amount"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/scenarios/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "DEBT", entityId, withAI,
          inputs: {
            principalCents: Math.round(p * 100),
            annualRatePct: parseFloat(rate),
            termMonths: parseInt(termMonths),
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onResult(json as DebtResult, json.inputs)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Loan Amount ($)</label>
          <input type="text" value={principal} onChange={(e) => setPrincipal(e.target.value)}
            placeholder="e.g. 100000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Annual Rate (%)</label>
          <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
            min="0" step="0.1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Term (months)</label>
          <input type="number" value={termMonths} onChange={(e) => setTermMonths(e.target.value)}
            min="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" checked={withAI} onChange={(e) => setWithAI(e.target.checked)} className="rounded border-gray-300 text-purple-600" />
        Include AI summary
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={compute} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
        Compute
      </button>
    </div>
  )
}

function DebtResultView({ result }: { result: DebtResult }) {
  const { before, after } = result
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase">
              <th className="text-left pb-2">Metric</th>
              <th className="text-right pb-2">Before</th>
              <th className="text-right pb-2">After</th>
              <th className="text-right pb-2">Change</th>
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Cash" before={before.cashCents} after={after.cashAfterFunding} />
            <CompareRow label="Monthly burn" before={before.monthlyBurnCents} after={after.newMonthlyBurnCents} invertGood />
            <CompareRow label="Runway" before={before.runwayMonths} after={after.runwayMonths} isCents={false} isRunway />
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Debt Summary</p>
        <div className="flex justify-between"><span className="text-gray-600">Loan proceeds</span><span className="font-mono text-green-700">+{fmt(after.loanProceedsCents)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Monthly payment</span><span className="font-mono text-red-600">({fmt(after.monthlyPaymentCents)})</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Total interest</span><span className="font-mono text-orange-600">{fmt(after.totalInterestCents)}</span></div>
        <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5"><span>Total repayment</span><span className="font-mono">{fmt(after.totalCostCents)}</span></div>
      </div>
    </div>
  )
}

// ─── Saved scenario card ──────────────────────────────────────────────────────

function SavedCard({ s, onDelete }: { s: SavedScenario; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function del() {
    setDeleting(true)
    await fetch(`/api/scenarios?id=${s.id}`, { method: "DELETE" })
    onDelete(s.id)
  }

  const typeLabel = s.type === "HIRING" ? "Hiring" : s.type === "EQUIPMENT" ? "Equipment" : "Debt"
  const typeColor = s.type === "HIRING" ? "bg-green-100 text-green-700" : s.type === "EQUIPMENT" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>{typeLabel}</span>
        <span className="font-medium text-gray-800 flex-1 truncate">{s.name}</span>
        <span className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</span>
        <button onClick={() => setOpen((o) => !o)} className="text-gray-400 hover:text-gray-600 p-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={del} disabled={deleting} className="text-gray-300 hover:text-red-500 p-1 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {s.result.type === "HIRING" && <HiringResultView result={s.result as HiringResult} />}
          {s.result.type === "EQUIPMENT" && <EquipmentResultView result={s.result as EquipmentResult} />}
          {s.result.type === "DEBT" && <DebtResultView result={s.result as DebtResult} />}
          {s.result.aiSummary && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />AI Summary
              </p>
              {s.result.aiSummary}
            </div>
          )}
          {s.notes && <p className="text-xs text-gray-500 italic">Notes: {s.notes}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS: { type: ScenarioType; label: string; desc: string }[] = [
  { type: "HIRING", label: "Hiring", desc: "Model salary, benefits, one-time costs, and runway impact" },
  { type: "EQUIPMENT", label: "Equipment", desc: "Cash vs financed purchase — cash impact and depreciation" },
  { type: "DEBT", label: "Loan / Debt", desc: "Monthly payment, total interest, runway with new payments" },
]

export function ScenarioPage({ entityId }: Props) {
  const [activeTab, setActiveTab] = useState<ScenarioType>("HIRING")
  const [result, setResult] = useState<ComputeResult | null>(null)
  const [lastInputs, setLastInputs] = useState<Record<string, unknown> | null>(null)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])
  const [saveName, setSaveName] = useState("")
  const [saveNotes, setSaveNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)

  const loadSaved = useCallback(async () => {
    const res = await fetch(`/api/scenarios?entityId=${entityId}`)
    if (res.ok) setSavedScenarios(await res.json())
  }, [entityId])

  useEffect(() => { loadSaved() }, [loadSaved])

  function handleResult(r: ComputeResult, inputs: Record<string, unknown>) {
    setResult(r); setLastInputs(inputs); setSaved(false); setShowSaveForm(false); setSaveName("")
  }

  async function saveScenario() {
    if (!result || !saveName.trim()) return
    setSaving(true)
    try {
      await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId, name: saveName.trim(), type: result.type,
          inputs: lastInputs, result, aiSummary: result.aiSummary ?? null, notes: saveNotes || null,
        }),
      })
      setSaved(true); setShowSaveForm(false)
      await loadSaved()
    } finally { setSaving(false) }
  }

  function handleDelete(id: string) {
    setSavedScenarios((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Scenario type tabs */}
      <div className="grid grid-cols-3 gap-3">
        {TABS.map((t) => (
          <button key={t.type} onClick={() => { setActiveTab(t.type); setResult(null) }}
            className={`text-left p-4 rounded-xl border transition-colors ${activeTab === t.type ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
            <p className={`font-semibold text-sm ${activeTab === t.type ? "text-blue-700" : "text-gray-800"}`}>{t.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
          </button>
        ))}
      </div>

      {/* Builder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          {activeTab === "HIRING" ? "Hiring Scenario" : activeTab === "EQUIPMENT" ? "Equipment Purchase" : "Loan / Debt"} Builder
        </h2>
        {activeTab === "HIRING" && (
          <HiringForm entityId={entityId}
            onResult={(r, inp) => handleResult(r as ComputeResult, inp)} />
        )}
        {activeTab === "EQUIPMENT" && (
          <EquipmentForm entityId={entityId}
            onResult={(r, inp) => handleResult(r as ComputeResult, inp)} />
        )}
        {activeTab === "DEBT" && (
          <DebtForm entityId={entityId}
            onResult={(r, inp) => handleResult(r as ComputeResult, inp)} />
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Results</h2>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              {!saved && (
                <button onClick={() => setShowSaveForm((s) => !s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  <Save className="w-3.5 h-3.5" /> Save scenario
                </button>
              )}
            </div>
          </div>

          {result.type === "HIRING" && <HiringResultView result={result as HiringResult} />}
          {result.type === "EQUIPMENT" && <EquipmentResultView result={result as EquipmentResult} />}
          {result.type === "DEBT" && <DebtResultView result={result as DebtResult} />}

          {result.aiSummary && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Summary
              </p>
              {result.aiSummary}
            </div>
          )}

          {showSaveForm && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600">Save this scenario</p>
              <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                placeholder="Scenario name (e.g. 'Engineer hire at $90k')"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={saveScenario} disabled={saving || !saveName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* Saved scenarios */}
      {savedScenarios.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            Saved Scenarios
            <span className="text-xs text-gray-400 font-normal">({savedScenarios.length})</span>
          </h2>
          {savedScenarios.map((s) => (
            <SavedCard key={s.id} s={s} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {savedScenarios.length === 0 && !result && (
        <div className="text-center py-12 text-gray-400">
          <Plus className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Run a scenario above to model the financial impact of a business decision.</p>
        </div>
      )}
    </div>
  )
}
