"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Search, Loader2, CheckCircle2, AlertCircle, Building2, Globe,
  Users, MapPin, Zap, Save, ChevronLeft, Compass,
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  "Manufacturing",
  "Food & Beverage",
  "Warehousing & Logistics",
  "Retail",
  "Healthcare",
  "Hospitality",
  "Construction",
  "Property Management",
  "Education",
  "Other",
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProspectResult {
  companyName:            string
  website:                string
  industry:               string
  employeeCountMin:       number
  employeeCountMax:       number
  locationsCount:         number
  headquartersCity:       string
  headquartersState:      string
  aiFitScore:             number
  researchSummary:        string
  operationalPainPoints:  string
  relayFitReasons:        string
  suggestedDemoEmphasis:  string
  suggestedOutreachAngle: string
  decisionMakerTitles:    string[]
  confidenceScore:        number
}

interface FormValues {
  industry:          string
  location:          string
  employeeCountMin:  string
  employeeCountMax:  string
  locationsMin:      string
  keywords:          string
  additionalContext: string
}

type SaveState = "idle" | "saving" | "saved" | "duplicate" | "error"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fitScoreStyle(score: number): { ring: string; text: string; bg: string } {
  if (score >= 80) return { ring: "border-green-700/60",  text: "text-green-400",  bg: "bg-green-900/25"  }
  if (score >= 60) return { ring: "border-amber-700/60",  text: "text-amber-400",  bg: "bg-amber-900/25"  }
  return               { ring: "border-red-800/60",    text: "text-red-400",    bg: "bg-red-900/20"    }
}

// ─── ProspectCard ─────────────────────────────────────────────────────────────

function ProspectCard({
  prospect,
  saveState,
  duplicateMsg,
  onSave,
}: {
  prospect:     ProspectResult
  saveState:    SaveState
  duplicateMsg: string | null
  onSave:       () => void
}) {
  const score = fitScoreStyle(prospect.aiFitScore)
  const displayWebsite = prospect.website
    ? prospect.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    : null
  const websiteHref = prospect.website
    ? (prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`)
    : null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3.5 hover:border-gray-700 transition-colors">

      {/* ── Company name + fit score ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-[15px] leading-snug">{prospect.companyName}</h3>
          {websiteHref && displayWebsite && (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-0.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Globe className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[180px]">{displayWebsite}</span>
            </a>
          )}
        </div>

        {/* Fit score badge */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-lg border ${score.bg} ${score.ring}`}>
          <span className={`text-2xl font-bold leading-none tabular-nums ${score.text}`}>
            {prospect.aiFitScore}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mt-0.5">fit</span>
        </div>
      </div>

      {/* ── Attribute badges ── */}
      <div className="flex flex-wrap gap-1.5">
        {prospect.industry && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700/80">
            <Building2 className="w-2.5 h-2.5" />
            {prospect.industry}
          </span>
        )}
        {(prospect.employeeCountMin > 0 || prospect.employeeCountMax > 0) && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700/80">
            <Users className="w-2.5 h-2.5" />
            {prospect.employeeCountMin && prospect.employeeCountMax
              ? `${prospect.employeeCountMin}–${prospect.employeeCountMax} emp.`
              : prospect.employeeCountMin
              ? `${prospect.employeeCountMin}+ emp.`
              : `≤${prospect.employeeCountMax} emp.`}
          </span>
        )}
        {prospect.locationsCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700/80">
            <MapPin className="w-2.5 h-2.5" />
            {prospect.locationsCount} locations
          </span>
        )}
        {(prospect.headquartersCity || prospect.headquartersState) && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/80">
            {[prospect.headquartersCity, prospect.headquartersState].filter(Boolean).join(", ")}
          </span>
        )}
      </div>

      {/* ── Research summary ── */}
      {prospect.researchSummary && (
        <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
          {prospect.researchSummary}
        </p>
      )}

      {/* ── Top pain point ── */}
      {prospect.operationalPainPoints && (
        <div className="flex gap-2 items-start bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2">
          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-px" />
          <p className="text-xs text-amber-300/80 leading-relaxed line-clamp-2">
            {prospect.operationalPainPoints}
          </p>
        </div>
      )}

      {/* ── Save action ── */}
      <div className="pt-1 border-t border-gray-800/80 mt-auto">
        {saveState === "saved" ? (
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium py-1">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Saved to CRM
          </div>
        ) : saveState === "duplicate" ? (
          <div className="flex items-start gap-2 text-amber-400 py-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
            <span className="text-xs leading-snug">{duplicateMsg ?? "Already exists in CRM"}</span>
          </div>
        ) : saveState === "error" ? (
          <button
            onClick={onSave}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-sm font-medium rounded-lg transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            Save failed — retry
          </button>
        ) : (
          <button
            onClick={onSave}
            disabled={saveState === "saving"}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saveState === "saving" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Prospect
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [form, setForm] = useState<FormValues>({
    industry:          "",
    location:          "",
    employeeCountMin:  "",
    employeeCountMax:  "",
    locationsMin:      "",
    keywords:          "",
    additionalContext: "",
  })

  const [loading,           setLoading]           = useState(false)
  const [results,           setResults]           = useState<ProspectResult[] | null>(null)
  const [error,             setError]             = useState<string | null>(null)
  const [saveStates,        setSaveStates]        = useState<Record<string, SaveState>>({})
  const [saveDuplicateMsgs, setSaveDuplicateMsgs] = useState<Record<string, string>>({})
  const [savingAll,         setSavingAll]         = useState(false)

  function set(field: keyof FormValues, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResults(null)
    setSaveStates({})
    setSaveDuplicateMsgs({})

    try {
      const body: Record<string, unknown> = {}
      if (form.industry)          body.industry          = form.industry
      if (form.location)          body.location          = form.location
      if (form.employeeCountMin)  body.employeeCountMin  = parseInt(form.employeeCountMin,  10)
      if (form.employeeCountMax)  body.employeeCountMax  = parseInt(form.employeeCountMax,  10)
      if (form.locationsMin)      body.locationsMin      = parseInt(form.locationsMin,      10)
      if (form.keywords)          body.keywords          = form.keywords
      if (form.additionalContext) body.additionalContext = form.additionalContext

      const res = await fetch("/api/super-admin/crm/prospects/discover", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; details?: string }
        setError(data.error ?? `Search failed (${res.status})`)
        return
      }

      const data = await res.json() as { prospects: ProspectResult[]; parseError?: boolean }
      setResults(data.prospects ?? [])

      if (data.parseError) {
        setError("AI returned results but some data may be incomplete — review carefully before saving.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed — check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  // ── Save one ─────────────────────────────────────────────────────────────────

  async function saveProspect(prospect: ProspectResult) {
    const key = prospect.companyName
    setSaveStates(prev => ({ ...prev, [key]: "saving" }))

    try {
      const res = await fetch("/api/super-admin/crm/prospects", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          companyName:       prospect.companyName,
          website:           prospect.website        || null,
          industry:          prospect.industry       || null,
          employeeCountMin:  prospect.employeeCountMin  || null,
          employeeCountMax:  prospect.employeeCountMax  || null,
          locationsCount:    prospect.locationsCount    || null,
          headquartersCity:  prospect.headquartersCity  || null,
          headquartersState: prospect.headquartersState || null,
          source:            "ai_research",
        }),
      })

      if (res.status === 409) {
        const data = await res.json() as { error: string; existing?: { companyName: string } }
        const msg = data.existing
          ? `Already in CRM as "${data.existing.companyName}"`
          : "Already exists in CRM"
        setSaveDuplicateMsgs(prev => ({ ...prev, [key]: msg }))
        setSaveStates(prev => ({ ...prev, [key]: "duplicate" }))
        return
      }

      if (!res.ok) {
        setSaveStates(prev => ({ ...prev, [key]: "error" }))
        return
      }

      setSaveStates(prev => ({ ...prev, [key]: "saved" }))
    } catch {
      setSaveStates(prev => ({ ...prev, [key]: "error" }))
    }
  }

  // ── Save all ──────────────────────────────────────────────────────────────────

  async function handleSaveAll() {
    if (!results) return
    setSavingAll(true)

    // Snapshot unsaved list before we start (avoids re-checking state during loop)
    const unsaved = results.filter(p => {
      const s = saveStates[p.companyName]
      return !s || s === "idle" || s === "error"
    })

    for (const prospect of unsaved) {
      await saveProspect(prospect)
    }

    setSavingAll(false)
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const unsavedCount = results
    ? results.filter(p => {
        const s = saveStates[p.companyName]
        return !s || s === "idle" || s === "error"
      }).length
    : 0

  // ── Shared input styles ────────────────────────────────────────────────────

  const inputCls =
    "w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white " +
    "placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 " +
    "focus:border-indigo-500 transition-colors"

  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5"

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-[1440px]">

      {/* Page header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/super-admin/crm/prospects"
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Back to Prospects"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Compass className="w-5 h-5 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Prospect Discovery</h1>
        </div>
        <p className="text-gray-400 text-sm ml-[52px]">
          Describe the companies you want to find — AI web research does the rest
        </p>
      </div>

      {/* Two-column layout: form left, results right */}
      <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-8 lg:items-start">

        {/* ═══════════════════════════════════════════════════════
            SECTION 1 — Search Form
        ════════════════════════════════════════════════════════ */}
        <div className="lg:sticky lg:top-8 mb-8 lg:mb-0">
          <form onSubmit={handleSearch} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">

            {/* Industry */}
            <div>
              <label className={labelCls}>Industry</label>
              <select
                value={form.industry}
                onChange={e => set("industry", e.target.value)}
                className={inputCls}
              >
                <option value="">All industries</option>
                {INDUSTRY_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => set("location", e.target.value)}
                placeholder="State, region, or city — e.g. Michigan, Southeast US"
                className={inputCls}
              />
            </div>

            {/* Employee count */}
            <div>
              <label className={labelCls}>Employee Count</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={form.employeeCountMin}
                  onChange={e => set("employeeCountMin", e.target.value)}
                  placeholder="Min"
                  min={0}
                  className={inputCls}
                />
                <input
                  type="number"
                  value={form.employeeCountMax}
                  onChange={e => set("employeeCountMax", e.target.value)}
                  placeholder="Max"
                  min={0}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Min locations */}
            <div>
              <label className={labelCls}>Minimum Locations</label>
              <input
                type="number"
                value={form.locationsMin}
                onChange={e => set("locationsMin", e.target.value)}
                placeholder="Min. number of locations/facilities"
                min={0}
                className={inputCls}
              />
            </div>

            {/* Keywords */}
            <div>
              <label className={labelCls}>Keywords</label>
              <input
                type="text"
                value={form.keywords}
                onChange={e => set("keywords", e.target.value)}
                placeholder="e.g. multi-facility, warehouse operations, maintenance teams"
                className={inputCls}
              />
            </div>

            {/* Additional context */}
            <div>
              <label className={labelCls}>Additional Context</label>
              <textarea
                value={form.additionalContext}
                onChange={e => set("additionalContext", e.target.value)}
                placeholder="e.g. Looking for companies running multiple warehouses with in-house maintenance teams"
                rows={3}
                className={inputCls + " resize-none"}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Find Prospects
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-gray-600 mt-3 px-1 leading-relaxed">
            AI research typically takes 15–30 seconds. Results are filtered against existing CRM records automatically.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SECTION 2 — Results
        ════════════════════════════════════════════════════════ */}
        <div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-indigo-900/30 border border-indigo-800/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
              </div>
              <div>
                <p className="text-white font-semibold text-base">
                  Searching for matching companies using AI web research…
                </p>
                <p className="text-gray-500 text-sm mt-1.5">This may take 15–30 seconds</p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && !loading && (
            <div className="flex items-start gap-3 bg-red-950/40 border border-red-800/60 rounded-xl px-4 py-3 text-sm text-red-300 mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results grid */}
          {results !== null && !loading && (
            <>
              {/* Results header row */}
              <div className="flex items-center justify-between mb-4 min-h-[36px]">
                <p className="text-sm text-gray-400">
                  Found{" "}
                  <span className="text-white font-semibold tabular-nums">{results.length}</span>{" "}
                  {results.length === 1 ? "company" : "companies"} matching your criteria
                </p>

                {results.length > 0 && unsavedCount > 0 && (
                  <button
                    onClick={handleSaveAll}
                    disabled={savingAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-sm text-gray-200 font-medium rounded-lg transition-colors"
                  >
                    {savingAll ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving all…
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save All ({unsavedCount})
                      </>
                    )}
                  </button>
                )}
              </div>

              {results.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl py-16 text-center">
                  <Compass className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-300 font-medium">No results found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Try broadening your criteria or adjusting the keywords.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {results.map(prospect => (
                    <ProspectCard
                      key={prospect.companyName}
                      prospect={prospect}
                      saveState={saveStates[prospect.companyName] ?? "idle"}
                      duplicateMsg={saveDuplicateMsgs[prospect.companyName] ?? null}
                      onSave={() => void saveProspect(prospect)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Empty initial state */}
          {results === null && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium">Configure your search and click Find Prospects</p>
              <p className="text-gray-600 text-sm mt-1.5 max-w-xs">
                AI web research will surface real companies that match your criteria.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
