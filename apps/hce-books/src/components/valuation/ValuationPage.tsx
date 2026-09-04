"use client"
import { useState, useCallback, useRef } from "react"
import { Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Download, RefreshCw } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type QualFactor = {
  name: string
  value: string
  pctAdjustment: number
  note: string
}

type ComputeResult = {
  entityId: string
  entityName: string
  consolidated: boolean
  asOf: string
  ttmPeriod: { start: string; end: string }
  financials: {
    revenueTTMCents: number
    cogsTTMCents: number
    grossProfitTTMCents: number
    grossMarginPct: number
    expensesTTMCents: number
    netIncomeTTMCents: number
    interestExpenseCents: number
    taxExpenseCents: number
    depreciationCents: number
    amortizationCents: number
    ebitdaCents: number
    ownerCompCents: number
    addbacksCents: number
    sdeCents: number
    revGrowthPct: number
    priorRevenueCents: number
    ebitdaMarginPct: number
  }
  multiples: {
    revMultiple: [number, number, number]
    ebitdaMultiple: [number, number, number]
    sdeMultiple: [number, number, number]
  }
  qualFactors: QualFactor[]
  totalQualAdjPct: number
  valuation: {
    byMethod: {
      revenue: { low: number; base: number; high: number }
      ebitda: { low: number; base: number; high: number }
      sde: { low: number; base: number; high: number }
    }
    adjusted: { low: number; base: number; high: number }
    primaryMethod: string
    primaryReason: string
  }
  drivers: QualFactor[]
  detractors: QualFactor[]
  neutral: QualFactor[]
  inputs: {
    industry: string
    ownerInvolvement: string
    customerConcentrationPct: number
    recurringRevenuePct: number
  }
}

const INDUSTRIES = [
  { value: "SAAS", label: "SaaS / Software" },
  { value: "PROFESSIONAL_SERVICES", label: "Professional Services" },
  { value: "ECOMMERCE", label: "E-Commerce" },
  { value: "RETAIL", label: "Retail" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "HEALTHCARE", label: "Healthcare / Medical" },
  { value: "FOOD_BEVERAGE", label: "Food & Beverage" },
  { value: "OTHER", label: "Other / General" },
]

const INDUSTRY_DEFAULTS: Record<string, {
  rev: [number, number, number]; ebitda: [number, number, number]; sde: [number, number, number]
}> = {
  SAAS:                  { rev: [2.5, 4.5, 8.0], ebitda: [10, 15, 22], sde: [3.0, 4.5, 6.5] },
  PROFESSIONAL_SERVICES: { rev: [0.5, 1.0, 2.0], ebitda: [4,  6,   8], sde: [2.0, 3.0, 4.0] },
  ECOMMERCE:             { rev: [0.5, 1.2, 2.5], ebitda: [5,  8,  14], sde: [2.0, 3.5, 5.0] },
  RETAIL:                { rev: [0.3, 0.6, 1.0], ebitda: [3,  5,   7], sde: [1.5, 2.5, 3.5] },
  MANUFACTURING:         { rev: [0.5, 0.8, 1.5], ebitda: [4,  6,   9], sde: [2.0, 3.0, 4.0] },
  HEALTHCARE:            { rev: [0.7, 1.2, 2.0], ebitda: [6,  9,  13], sde: [2.5, 3.5, 5.0] },
  FOOD_BEVERAGE:         { rev: [0.3, 0.5, 0.8], ebitda: [3,  5,   7], sde: [1.5, 2.5, 3.5] },
  OTHER:                 { rev: [0.5, 1.0, 2.0], ebitda: [4,  7,  11], sde: [2.0, 3.0, 4.5] },
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtM(cents: number): string {
  const abs = Math.abs(cents)
  if (abs >= 100_000_000) return `${(cents / 100_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)   return `${(cents / 1_000_000).toFixed(2)}M`
  if (abs >= 100_000)     return `${(cents / 100_000).toFixed(0)}K`
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}
function fmtFull(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}
function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FinancialRow({ label, cents, highlight, negative }: {
  label: string; cents: number; highlight?: boolean; negative?: boolean
}) {
  const isNeg = cents < 0 || negative
  return (
    <div className={`flex justify-between items-center py-1.5 ${highlight ? "border-t border-gray-300 font-semibold" : ""}`}>
      <span className={`text-sm ${highlight ? "text-gray-900" : "text-gray-600"}`}>{label}</span>
      <span className={`text-sm font-mono ${isNeg ? "text-red-600" : highlight ? "text-gray-900" : "text-gray-800"}`}>
        {cents < 0 ? `(${fmtFull(Math.abs(cents))})` : fmtFull(cents)}
      </span>
    </div>
  )
}

function NumInput({ label, value, onChange, step = 0.5, min, max, suffix }: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; max?: number; suffix?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step} min={min} max={max}
          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {suffix && <span className="text-xs text-gray-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  )
}

function MultipleRange({ label, value, onChange }: {
  label: string
  value: [number, number, number]
  onChange: (v: [number, number, number]) => void
}) {
  const set = (i: 0 | 1 | 2) => (v: number) => {
    const next: [number, number, number] = [...value] as [number, number, number]
    next[i] = v
    onChange(next)
  }
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">{label} multiple (low / base / high)</p>
      <div className="grid grid-cols-3 gap-2">
        {(["Low", "Base", "High"] as const).map((lbl, i) => (
          <div key={lbl}>
            <label className="block text-xs text-gray-400 mb-0.5">{lbl}</label>
            <input type="number" value={value[i]} step={0.5} min={0}
              onChange={(e) => set(i as 0 | 1 | 2)(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ValuationPage({ entityId, isConsolidationParent }: { entityId: string; isConsolidationParent: boolean }) {
  const printRef = useRef<HTMLDivElement>(null)

  // Inputs state
  const [industry, setIndustry] = useState("OTHER")
  const [consolidated, setConsolidated] = useState(false)
  const [ownerCompDollars, setOwnerCompDollars] = useState("")
  const [addbacksDollars, setAddbacksDollars] = useState("")
  const [ownerInvolvement, setOwnerInvolvement] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM")
  const [customerConcentration, setCustomerConcentration] = useState(20)
  const [recurringRevenue, setRecurringRevenue] = useState(30)

  const def = INDUSTRY_DEFAULTS[industry] ?? INDUSTRY_DEFAULTS.OTHER
  const [revMultiple, setRevMultiple] = useState<[number, number, number]>(def.rev)
  const [ebitdaMultiple, setEbitdaMultiple] = useState<[number, number, number]>(def.ebitda)
  const [sdeMultiple, setSdeMultiple] = useState<[number, number, number]>(def.sde)

  // Result state
  const [result, setResult] = useState<ComputeResult | null>(null)
  const [computing, setComputing] = useState(false)
  const [computeError, setComputeError] = useState("")

  // AI narrative
  const [narrative, setNarrative] = useState("")
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeError, setNarrativeError] = useState("")

  // UI state
  const [showInputs, setShowInputs] = useState(true)
  const [showFinancials, setShowFinancials] = useState(true)

  function applyIndustryDefaults(ind: string) {
    setIndustry(ind)
    const d = INDUSTRY_DEFAULTS[ind] ?? INDUSTRY_DEFAULTS.OTHER
    setRevMultiple(d.rev)
    setEbitdaMultiple(d.ebitda)
    setSdeMultiple(d.sde)
  }

  const compute = useCallback(async () => {
    setComputing(true); setComputeError(""); setNarrative("")
    try {
      const res = await fetch("/api/valuation/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId, consolidated,
          ownerCompCents: Math.round((parseFloat(ownerCompDollars.replace(/[^0-9.]/g, "")) || 0) * 100),
          addbacksCents: Math.round((parseFloat(addbacksDollars.replace(/[^0-9.]/g, "")) || 0) * 100),
          ownerInvolvement, customerConcentrationPct: customerConcentration,
          recurringRevenuePct: recurringRevenue, industry, revMultiple, ebitdaMultiple, sdeMultiple,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Compute failed")
      setResult(json as ComputeResult)
      setShowInputs(false)
    } catch (e) { setComputeError((e as Error).message) }
    finally { setComputing(false) }
  }, [entityId, consolidated, ownerCompDollars, addbacksDollars, ownerInvolvement,
    customerConcentration, recurringRevenue, industry, revMultiple, ebitdaMultiple, sdeMultiple])

  async function generateNarrative() {
    if (!result) return
    setNarrativeLoading(true); setNarrativeError("")
    try {
      const res = await fetch("/api/valuation/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ computeResult: result }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setNarrative(json.narrative)
    } catch (e) { setNarrativeError((e as Error).message) }
    finally { setNarrativeLoading(false) }
  }

  function exportCSV() {
    if (!result) return
    const f = result.financials
    const v = result.valuation
    const rows = [
      ["Metric", "Value"],
      ["Entity", result.entityName],
      ["As of", new Date(result.asOf).toLocaleDateString()],
      ["TTM Revenue", (f.revenueTTMCents / 100).toFixed(2)],
      ["Gross Profit", (f.grossProfitTTMCents / 100).toFixed(2)],
      ["Gross Margin %", f.grossMarginPct.toFixed(2)],
      ["Net Income", (f.netIncomeTTMCents / 100).toFixed(2)],
      ["EBITDA", (f.ebitdaCents / 100).toFixed(2)],
      ["EBITDA Margin %", f.ebitdaMarginPct.toFixed(2)],
      ["SDE", (f.sdeCents / 100).toFixed(2)],
      ["Revenue Growth %", f.revGrowthPct.toFixed(2)],
      ["Valuation Low", (v.adjusted.low / 100).toFixed(2)],
      ["Valuation Base", (v.adjusted.base / 100).toFixed(2)],
      ["Valuation High", (v.adjusted.high / 100).toFixed(2)],
      ["Total Qual Adjustment %", result.totalQualAdjPct.toFixed(2)],
      ...result.qualFactors.map((f) => [`Adjustment: ${f.name}`, `${f.pctAdjustment}%`]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const a = document.createElement("a"); a.href = url; a.download = `valuation-${result.entityName}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const fin = result?.financials
  const val = result?.valuation

  return (
    <div className="space-y-6" ref={printRef}>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
        <p><strong>Indicative estimate only.</strong> This is a planning tool, not a certified appraisal. Multiples are illustrative ranges; actual transaction values depend on deal structure, due diligence, buyer appetite, and market conditions. Consult a qualified business valuation professional for any transaction.</p>
      </div>

      {/* Inputs panel */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Valuation Inputs</h2>
          <div className="flex items-center gap-2">
            {isConsolidationParent && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                Consolidated
              </label>
            )}
            <button onClick={() => setShowInputs((s) => !s)} className="text-gray-400 hover:text-gray-600 p-1">
              {showInputs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showInputs && (
          <div className="p-5 space-y-6">
            {/* Industry */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Industry</label>
              <div className="grid grid-cols-4 gap-2">
                {INDUSTRIES.map((ind) => (
                  <button key={ind.value} onClick={() => applyIndustryDefaults(ind.value)}
                    className={`px-3 py-2 text-xs rounded-lg border text-left transition-colors ${industry === ind.value ? "border-blue-300 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    {ind.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Financials from books + user add-backs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Owner Compensation Add-back ($)</label>
                <input type="text" value={ownerCompDollars} onChange={(e) => setOwnerCompDollars(e.target.value)}
                  placeholder="e.g. 150000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Owner salary already in expenses</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Other Add-backs / Normalizations ($)</label>
                <input type="text" value={addbacksDollars} onChange={(e) => setAddbacksDollars(e.target.value)}
                  placeholder="e.g. 25000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">One-time expenses, owner perks, etc.</p>
              </div>
            </div>

            {/* Qualitative factors */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Owner Involvement</label>
                <select value={ownerInvolvement} onChange={(e) => setOwnerInvolvement(e.target.value as "HIGH" | "MEDIUM" | "LOW")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="LOW">Low — business runs without owner</option>
                  <option value="MEDIUM">Medium — owner active but not critical</option>
                  <option value="HIGH">High — business depends on owner</option>
                </select>
              </div>
              <NumInput label="Top Customer Concentration (%)" value={customerConcentration}
                onChange={setCustomerConcentration} step={5} min={0} max={100} suffix="% of rev" />
              <NumInput label="Recurring Revenue (%)" value={recurringRevenue}
                onChange={setRecurringRevenue} step={5} min={0} max={100} suffix="% recurring" />
            </div>

            {/* Multiples */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Valuation Multiples (overridden from industry defaults)</p>
              <div className="grid grid-cols-3 gap-4">
                <MultipleRange label="Revenue" value={revMultiple} onChange={setRevMultiple} />
                <MultipleRange label="EBITDA" value={ebitdaMultiple} onChange={setEbitdaMultiple} />
                <MultipleRange label="SDE" value={sdeMultiple} onChange={setSdeMultiple} />
              </div>
            </div>

            {computeError && <p className="text-sm text-red-600">{computeError}</p>}

            <button onClick={compute} disabled={computing}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {computing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {result ? "Recompute" : "Compute Valuation"}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {result && fin && val && (
        <>
          {/* Valuation range — prominent */}
          <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Indicative Valuation Range</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {result.entityName} · TTM ending {new Date(result.ttmPeriod.end).toLocaleDateString()} · {INDUSTRIES.find((i) => i.value === result.inputs.industry)?.label ?? result.inputs.industry}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Print / PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: "Low", val: val.adjusted.low, color: "bg-red-50 border-red-200 text-red-700" },
                { label: "Base", val: val.adjusted.base, color: "bg-blue-50 border-blue-300 text-blue-800" },
                { label: "High", val: val.adjusted.high, color: "bg-green-50 border-green-200 text-green-700" },
              ].map(({ label, val: v, color }) => (
                <div key={label} className={`rounded-xl border-2 p-5 text-center ${color}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
                  <p className="text-3xl font-bold font-mono mt-2">{fmtM(v)}</p>
                  <p className="text-xs mt-1 opacity-60">{fmtFull(v)}</p>
                </div>
              ))}
            </div>

            {/* Progress bar showing relative range */}
            <div className="relative h-2 bg-gray-100 rounded-full mb-3">
              <div className="absolute h-2 bg-gradient-to-r from-red-300 via-blue-400 to-green-300 rounded-full"
                style={{ left: "0%", right: "0%" }} />
              <div className="absolute w-3 h-3 bg-blue-600 rounded-full -top-0.5 border-2 border-white shadow"
                style={{
                  left: `${((val.adjusted.base - val.adjusted.low) / Math.max(val.adjusted.high - val.adjusted.low, 1)) * 100}%`,
                  transform: "translateX(-50%)",
                }} />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Range: {fmtM(val.adjusted.low)} – {fmtM(val.adjusted.high)} · Base qualitative adj: {result.totalQualAdjPct >= 0 ? "+" : ""}{result.totalQualAdjPct.toFixed(0)}%
            </p>

            <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <strong>Primary method:</strong> {val.primaryMethod.toUpperCase()} — {val.primaryReason}
            </p>
          </div>

          {/* Method breakdown */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Valuation by Method</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium uppercase">Method</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 font-medium uppercase">Metric (TTM)</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 font-medium uppercase">Multiple (L/B/H)</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 font-medium uppercase">Low</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 font-medium uppercase">Base (adj.)</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 font-medium uppercase">High</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr className={val.primaryMethod === "revenue" ? "bg-blue-50" : ""}>
                    <td className="px-5 py-3 font-medium">Revenue{val.primaryMethod === "revenue" && <span className="ml-2 text-xs text-blue-600 font-semibold">★ primary</span>}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtFull(fin.revenueTTMCents)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{result.multiples.revMultiple.join("x / ")}x</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtM(val.byMethod.revenue.low)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmtM(val.byMethod.revenue.base)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtM(val.byMethod.revenue.high)}</td>
                  </tr>
                  <tr className={val.primaryMethod === "ebitda" ? "bg-blue-50" : ""}>
                    <td className="px-5 py-3 font-medium">EBITDA{val.primaryMethod === "ebitda" && <span className="ml-2 text-xs text-blue-600 font-semibold">★ primary</span>}</td>
                    <td className="px-4 py-3 text-right font-mono">{fin.ebitdaCents > 0 ? fmtFull(fin.ebitdaCents) : <span className="text-gray-400">negative</span>}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{result.multiples.ebitdaMultiple.join("x / ")}x</td>
                    <td className="px-4 py-3 text-right font-mono">{fin.ebitdaCents > 0 ? fmtM(val.byMethod.ebitda.low) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fin.ebitdaCents > 0 ? fmtM(val.byMethod.ebitda.base) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{fin.ebitdaCents > 0 ? fmtM(val.byMethod.ebitda.high) : "—"}</td>
                  </tr>
                  <tr className={val.primaryMethod === "sde" ? "bg-blue-50" : ""}>
                    <td className="px-5 py-3 font-medium">SDE{val.primaryMethod === "sde" && <span className="ml-2 text-xs text-blue-600 font-semibold">★ primary</span>}</td>
                    <td className="px-4 py-3 text-right font-mono">{fin.sdeCents > 0 ? fmtFull(fin.sdeCents) : <span className="text-gray-400">negative</span>}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{result.multiples.sdeMultiple.join("x / ")}x</td>
                    <td className="px-4 py-3 text-right font-mono">{fin.sdeCents > 0 ? fmtM(val.byMethod.sde.low) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fin.sdeCents > 0 ? fmtM(val.byMethod.sde.base) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{fin.sdeCents > 0 ? fmtM(val.byMethod.sde.high) : "—"}</td>
                  </tr>
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                    <td className="px-5 py-3">Reconciled Range</td>
                    <td colSpan={2} />
                    <td className="px-4 py-3 text-right font-mono text-red-700">{fmtM(val.adjusted.low)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-700">{fmtM(val.adjusted.base)}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">{fmtM(val.adjusted.high)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial metrics */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Underlying Financials (TTM)</h2>
              <button onClick={() => setShowFinancials((s) => !s)} className="text-gray-400 hover:text-gray-600 p-1">
                {showFinancials ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            {showFinancials && (
              <div className="grid grid-cols-2 gap-6 p-5">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">P&L (from ledger)</p>
                  <FinancialRow label="Revenue" cents={fin.revenueTTMCents} />
                  <FinancialRow label="COGS" cents={-fin.cogsTTMCents} negative />
                  <FinancialRow label="Gross Profit" cents={fin.grossProfitTTMCents} highlight />
                  <p className="text-xs text-gray-400 text-right mt-0.5 mb-2">Margin: {fin.grossMarginPct.toFixed(1)}%</p>
                  <FinancialRow label="Operating Expenses" cents={-fin.expensesTTMCents} negative />
                  <FinancialRow label="Net Income" cents={fin.netIncomeTTMCents} highlight />
                  <p className="text-xs text-gray-400 mt-3">
                    Revenue growth: {fin.revGrowthPct >= 0 ? "+" : ""}{fin.revGrowthPct.toFixed(1)}% vs prior 12 months ({fmtFull(fin.priorRevenueCents)})
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">EBITDA Bridge (from ledger + fixed assets)</p>
                  <FinancialRow label="Net Income" cents={fin.netIncomeTTMCents} />
                  <FinancialRow label="+ Interest Expense" cents={fin.interestExpenseCents} />
                  <FinancialRow label="+ Tax Expense" cents={fin.taxExpenseCents} />
                  <FinancialRow label="+ Depreciation" cents={fin.depreciationCents} />
                  <FinancialRow label="+ Amortization" cents={fin.amortizationCents} />
                  <FinancialRow label="= EBITDA" cents={fin.ebitdaCents} highlight />
                  <p className="text-xs text-gray-400 mt-0.5 mb-2 text-right">Margin: {fin.ebitdaMarginPct.toFixed(1)}%</p>
                  <FinancialRow label="+ Owner Compensation (input)" cents={fin.ownerCompCents} />
                  <FinancialRow label="+ Other Add-backs (input)" cents={fin.addbacksCents} />
                  <FinancialRow label="= SDE" cents={fin.sdeCents} highlight />
                </div>
              </div>
            )}
          </div>

          {/* Qualitative adjustments */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Qualitative Adjustments to Base Valuation</h2>
              <p className="text-xs text-gray-400 mt-0.5">Each factor below adjusts the base valuation. Every adjustment is shown so the math is fully transparent.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs text-gray-400 uppercase font-medium">Factor</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase font-medium">Value</th>
                    <th className="px-4 py-3 text-center text-xs text-gray-400 uppercase font-medium">Adj</th>
                    <th className="px-5 py-3 text-left text-xs text-gray-400 uppercase font-medium">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.qualFactors.map((f) => (
                    <tr key={f.name}>
                      <td className="px-5 py-3 font-medium text-gray-800">{f.name}</td>
                      <td className="px-4 py-3 text-gray-600">{f.value}</td>
                      <td className={`px-4 py-3 text-center font-mono font-semibold ${f.pctAdjustment > 0 ? "text-green-700" : f.pctAdjustment < 0 ? "text-red-600" : "text-gray-400"}`}>
                        {f.pctAdjustment >= 0 ? "+" : ""}{f.pctAdjustment}%
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{f.note}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                    <td className="px-5 py-3" colSpan={2}>Total qualitative adjustment</td>
                    <td className={`px-4 py-3 text-center font-mono ${result.totalQualAdjPct >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {result.totalQualAdjPct >= 0 ? "+" : ""}{result.totalQualAdjPct.toFixed(0)}%
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">Applied to base multiple scenario</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Value drivers and detractors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <h2 className="text-sm font-semibold text-gray-700">Value Drivers</h2>
              </div>
              <div className="p-4 space-y-2">
                {result.drivers.length === 0 ? (
                  <p className="text-sm text-gray-400">No significant positive factors identified.</p>
                ) : result.drivers.map((d) => (
                  <div key={d.name} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                    <span className="text-xs font-bold text-green-600 mt-0.5 whitespace-nowrap">+{d.pctAdjustment}%</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.name}</p>
                      <p className="text-xs text-gray-500">{d.value} — {d.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-semibold text-gray-700">Value Detractors</h2>
              </div>
              <div className="p-4 space-y-2">
                {result.detractors.length === 0 ? (
                  <p className="text-sm text-gray-400">No significant negative factors identified.</p>
                ) : result.detractors.map((d) => (
                  <div key={d.name} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-xs font-bold text-red-600 mt-0.5 whitespace-nowrap">{d.pctAdjustment}%</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.name}</p>
                      <p className="text-xs text-gray-500">{d.value} — {d.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Narrative */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                AI Value Analysis & Recommendations
              </h2>
              <button onClick={generateNarrative} disabled={narrativeLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {narrativeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {narrative ? "Regenerate" : "Generate Analysis"}
              </button>
            </div>

            {narrativeError && <p className="text-sm text-red-600 mb-3">{narrativeError}</p>}

            {!narrative && !narrativeLoading && (
              <p className="text-sm text-gray-400">
                Click "Generate Analysis" to get AI-written value drivers, detractors, and specific recommendations grounded in this entity&apos;s actual metrics.
              </p>
            )}

            {narrativeLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing {result.entityName}&apos;s value drivers from computed metrics…
              </div>
            )}

            {narrative && (
              <div className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {narrative}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
