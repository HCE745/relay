"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Search, Loader2, X, ChevronLeft, ExternalLink,
  MapPin, Users, Zap, CheckCircle2, AlertTriangle,
  RefreshCw, Send, Building2, Star, Mail,
} from "lucide-react"
import type { DiscoveredCompany } from "@/app/api/super-admin/crm/prospects/discover/route"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailDraft {
  subject: string
  body:    string
}

type SearchState = "idle" | "loading" | "done" | "error"
type EmailState  = "idle" | "loading" | "ready" | "sending" | "sent" | "error"
type SaveState   = "idle" | "saving" | "saved" | "error"

interface DuplicateInfo {
  companyName: string | null
  prospectId:  string | null
  demoCallId:  string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fitBadge(score: number) {
  if (score >= 80) return { bg: "bg-green-900/40",  border: "border-green-700/50",  text: "text-green-400"  }
  if (score >= 60) return { bg: "bg-amber-900/40",  border: "border-amber-700/50",  text: "text-amber-400"  }
  return              { bg: "bg-red-900/30",      border: "border-red-800/50",    text: "text-red-400"    }
}

function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
}

// ─── Company Card (search results) ───────────────────────────────────────────

function CompanyCard({ company, selected, onClick }: {
  company:  DiscoveredCompany
  selected: boolean
  onClick:  () => void
}) {
  const badge = fitBadge(company.fitScore)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border rounded-xl p-4 transition-all cursor-pointer ${
        selected ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-gray-800 hover:border-gray-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-[14px] leading-snug truncate">{company.companyName}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
            {(company.city || company.state) && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {[company.city, company.state].filter(Boolean).join(", ")}
              </span>
            )}
            {company.estimatedEmployees && (
              <><span className="text-gray-600">·</span>
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />{company.estimatedEmployees} emp.
              </span></>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${badge.bg} ${badge.border}`}>
          <span className={`text-xl font-bold leading-none tabular-nums ${badge.text}`}>{company.fitScore}</span>
          <span className="text-[8px] uppercase tracking-widest text-gray-500 mt-0.5">fit</span>
        </div>
      </div>
      {company.industry && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/60 mb-2">
          <Building2 className="w-2.5 h-2.5" />{company.industry}
        </span>
      )}
      {company.summary && (
        <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-2">{company.summary}</p>
      )}
      {company.painPoints?.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5">
          <Zap className="w-3 h-3 text-amber-400 flex-shrink-0 mt-px" />
          <p className="text-[11px] text-amber-300/70 line-clamp-1">{company.painPoints[0]}</p>
        </div>
      )}
    </button>
  )
}

// ─── Slide-over panel ─────────────────────────────────────────────────────────

function SlideOver({ company, onClose }: {
  company: DiscoveredCompany
  onClose: () => void
}) {
  const badge = fitBadge(company.fitScore)

  // Email state
  const [emailState,  setEmailState]  = useState<EmailState>("idle")
  const [draft,       setDraft]       = useState<EmailDraft | null>(null)
  const [toEmail,     setToEmail]     = useState("")
  const [subject,     setSubject]     = useState("")
  const [emailBody,   setEmailBody]   = useState("")
  const [emailError,  setEmailError]  = useState<string | null>(null)
  const [sentIds,     setSentIds]     = useState<{ prospectId: string; demoCallId: string } | null>(null)
  const [duplicate,   setDuplicate]   = useState<DuplicateInfo | null>(null)
  const [saveState,   setSaveState]   = useState<SaveState>("idle")

  // Auto-generate email when panel opens
  const generateEmail = useCallback(async () => {
    setEmailState("loading")
    setEmailError(null)
    setDuplicate(null)
    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      })
      if (!res.ok) throw new Error(`Generation failed (${res.status})`)
      const data = await res.json() as EmailDraft
      setDraft(data)
      setSubject(data.subject)
      setEmailBody(data.body)
      setEmailState("ready")
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to generate email")
      setEmailState("error")
    }
  }, [company])

  useEffect(() => { generateEmail() }, [generateEmail])

  async function handleSend(force = false) {
    if (!toEmail.trim()) { setEmailError("Enter a recipient email address"); return }
    if (emailState === "sending") return
    setEmailState("sending")
    setEmailError(null)
    setDuplicate(null)
    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, to: toEmail.trim(), subject, emailBody, force }),
      })
      if (res.status === 409) {
        const data = await res.json() as DuplicateInfo & { duplicate: boolean }
        setDuplicate({ companyName: data.companyName, prospectId: data.prospectId, demoCallId: data.demoCallId })
        setEmailState("ready")
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Send failed (${res.status})`)
      }
      const data = await res.json() as { prospectId: string; demoCallId: string }
      setSentIds(data)
      setEmailState("sent")
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Send failed")
      setEmailState("ready")
    }
  }

  async function handleSaveOnly() {
    setSaveState("saving")
    try {
      const res = await fetch("/api/super-admin/crm/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:           company.companyName,
          website:               company.website || null,
          industry:              company.industry || null,
          headquartersCity:      company.city || null,
          headquartersState:     company.state || null,
          source:                "ai_research",
        }),
      })
      if (res.status === 409) { setSaveState("saved"); return }
      if (!res.ok) throw new Error("Save failed")
      setSaveState("saved")
    } catch {
      setSaveState("error")
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-full sm:w-[520px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base leading-snug">{company.companyName}</h2>
            <div className="flex items-center flex-wrap gap-2 mt-1">
              {(company.city || company.state) && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{[company.city, company.state].filter(Boolean).join(", ")}
                </span>
              )}
              {company.industry && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />{company.industry}
                </span>
              )}
              {company.estimatedEmployees && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />{company.estimatedEmployees} employees
                </span>
              )}
              {company.website && (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  onClick={e => e.stopPropagation()}>
                  <ExternalLink className="w-3 h-3" />{cleanUrl(company.website)}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${badge.bg} ${badge.border}`}>
              <span className={`text-xl font-bold tabular-nums ${badge.text}`}>{company.fitScore}</span>
              <span className="text-[8px] uppercase tracking-widest text-gray-500">fit</span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">

            {/* Summary */}
            {company.summary && (
              <div>
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Summary</p>
                <p className="text-sm text-gray-300 leading-relaxed">{company.summary}</p>
              </div>
            )}

            {/* Pain Points */}
            {company.painPoints?.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Operational Pain Points</p>
                <ul className="space-y-1.5">
                  {company.painPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-amber-300/80">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Relay Fit Reasons */}
            {company.relayFitReasons?.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Why Relay Fits</p>
                <ul className="space-y-1.5">
                  {company.relayFitReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Star className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-300">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Outreach Angle */}
            {company.suggestedOutreachAngle && (
              <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-lg px-3.5 py-2.5">
                <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Outreach Angle</p>
                <p className="text-sm text-indigo-200/80">{company.suggestedOutreachAngle}</p>
              </div>
            )}

            {/* ── Email Draft ────────────────────────────────────────────────── */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Outreach Email
                </p>
                {emailState !== "loading" && emailState !== "sending" && emailState !== "sent" && (
                  <button onClick={generateEmail}
                    className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800">
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                )}
              </div>

              {emailState === "sent" && sentIds && (
                <div className="bg-green-900/30 border border-green-700/40 rounded-lg p-3.5">
                  <div className="flex items-center gap-2 text-green-400 font-medium text-sm mb-2">
                    <CheckCircle2 className="w-4 h-4" /> Email sent
                  </div>
                  <p className="text-xs text-green-300/70 mb-2">
                    {company.companyName} saved to CRM and enrolled in Cold Outreach follow-up sequence.
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/super-admin/crm/prospects/${sentIds.prospectId}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline">
                      View prospect →
                    </Link>
                    <span className="text-gray-600">·</span>
                    <Link href="/super-admin/crm/email"
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline">
                      View in inbox →
                    </Link>
                  </div>
                </div>
              )}

              {emailState !== "sent" && (
                <>
                  {/* Loading skeleton */}
                  {emailState === "loading" && (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-8 bg-gray-800 rounded-lg" />
                      <div className="h-32 bg-gray-800 rounded-lg" />
                    </div>
                  )}

                  {/* Error state */}
                  {emailState === "error" && (
                    <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {emailError ?? "Failed to generate email"}
                    </div>
                  )}

                  {/* Draft ready */}
                  {(emailState === "ready" || emailState === "sending") && draft && (
                    <div className="space-y-3">
                      {/* Duplicate warning */}
                      {duplicate && (
                        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-300">
                              <p className="font-medium mb-1">You&apos;ve previously contacted {duplicate.companyName ?? company.companyName}.</p>
                              <div className="flex gap-2 flex-wrap">
                                {duplicate.prospectId && (
                                  <Link href={`/super-admin/crm/prospects/${duplicate.prospectId}`}
                                    className="underline hover:text-amber-200">View existing prospect</Link>
                                )}
                                <button onClick={() => { setDuplicate(null); handleSend(true) }}
                                  className="underline hover:text-amber-200">Send anyway</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* To field */}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">To</label>
                        <input
                          type="email"
                          placeholder="recipient@company.com"
                          value={toEmail}
                          onChange={e => setToEmail(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Subject</label>
                        <input
                          type="text"
                          value={subject}
                          onChange={e => setSubject(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {/* Body */}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Body</label>
                        <textarea
                          rows={10}
                          value={emailBody}
                          onChange={e => setEmailBody(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white leading-relaxed focus:outline-none focus:border-indigo-500 transition-colors resize-none font-mono"
                        />
                      </div>

                      {/* Error */}
                      {emailError && !duplicate && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />{emailError}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleSend()}
                          disabled={emailState === "sending"}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {emailState === "sending"
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                            : <><Send className="w-4 h-4" /> Send Now</>
                          }
                        </button>
                        <button
                          onClick={handleSaveOnly}
                          disabled={saveState === "saving" || saveState === "saved" || emailState === "sending"}
                          className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                        >
                          {saveState === "saved" ? "✓ Saved" : saveState === "saving" ? "Saving…" : "Save only"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Search Form ──────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  "Manufacturing", "Food & Beverage", "Warehousing & Logistics",
  "Retail", "Healthcare", "Hospitality", "Construction",
  "Property Management", "Education",
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [industry,    setIndustry]    = useState("")
  const [location,    setLocation]    = useState("")
  const [empMin,      setEmpMin]      = useState("")
  const [empMax,      setEmpMax]      = useState("")
  const [locMin,      setLocMin]      = useState("")
  const [keywords,    setKeywords]    = useState("")
  const [context,     setContext]     = useState("")

  const [searchState, setSearchState] = useState<SearchState>("idle")
  const [companies,   setCompanies]   = useState<DiscoveredCompany[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected,    setSelected]    = useState<DiscoveredCompany | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchState("loading")
    setSearchError(null)
    setCompanies([])
    setSelected(null)

    const body: Record<string, unknown> = {}
    if (industry)  body.industry          = industry
    if (location)  body.location          = location
    if (empMin)    body.employeeCountMin   = parseInt(empMin,  10)
    if (empMax)    body.employeeCountMax   = parseInt(empMax,  10)
    if (locMin)    body.locationsMin       = parseInt(locMin,  10)
    if (keywords)  body.keywords           = keywords
    if (context)   body.additionalContext  = context

    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Search failed (${res.status})`)
      }
      const data = await res.json() as { companies: DiscoveredCompany[] }
      setCompanies(data.companies ?? [])
      setSearchState("done")
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed")
      setSearchState("error")
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link href="/super-admin/crm/prospects"
          className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-sm font-semibold text-white">Prospect Discovery</h1>
          <p className="text-[11px] text-gray-500">AI-powered search for new sales prospects</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* ── Left: Search form ───────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
          <form onSubmit={handleSearch} className="p-4 space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5">Industry</label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Any industry</option>
                {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5">Region / Location</label>
              <input
                type="text" placeholder="e.g. Midwest, Texas, Southeast"
                value={location} onChange={e => setLocation(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5">Employee Count</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={empMin} onChange={e => setEmpMin(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <input type="number" placeholder="Max" value={empMax} onChange={e => setEmpMax(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5">Min. Locations</label>
              <input type="number" placeholder="e.g. 3" value={locMin} onChange={e => setLocMin(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5">Keywords</label>
              <input type="text" placeholder="e.g. warehousing, cold storage" value={keywords} onChange={e => setKeywords(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1.5">Additional Context</label>
              <textarea rows={3} placeholder="Any other targeting details..." value={context} onChange={e => setContext(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
            </div>

            <button
              type="submit"
              disabled={searchState === "loading"}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {searchState === "loading"
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
                : <><Search className="w-4 h-4" /> Find Prospects</>
              }
            </button>

            {searchState === "loading" && (
              <p className="text-[11px] text-gray-500 text-center">
                AI is searching the web for real companies — this takes ~30 seconds
              </p>
            )}
          </form>
        </div>

        {/* ── Right: Results ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchState === "idle" && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <Search className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium mb-1">Search for prospects</p>
              <p className="text-sm text-gray-600">
                Fill in your criteria and click Find Prospects. The AI will search the web for real companies and generate personalized outreach emails.
              </p>
            </div>
          )}

          {searchState === "loading" && (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-gray-400 font-medium">Finding prospects…</p>
              <p className="text-sm text-gray-600 mt-1">Searching the web for real companies</p>
            </div>
          )}

          {searchState === "error" && (
            <div className="h-full flex items-center justify-center">
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-6 text-center max-w-sm">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-300 font-medium mb-1">Search failed</p>
                <p className="text-sm text-red-400/70">{searchError}</p>
              </div>
            </div>
          )}

          {searchState === "done" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-300 font-medium">
                  Found {companies.length} {companies.length === 1 ? "company" : "companies"}
                </p>
                {companies.length > 0 && (
                  <p className="text-[11px] text-gray-500">Click a card to generate an outreach email</p>
                )}
              </div>

              {companies.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>No companies found for this search.</p>
                  <p className="text-sm mt-1">Try broader criteria.</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {companies.map(c => (
                  <CompanyCard
                    key={c.companyName}
                    company={c}
                    selected={selected?.companyName === c.companyName}
                    onClick={() => setSelected(prev => prev?.companyName === c.companyName ? null : c)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Slide-over */}
      {selected && (
        <SlideOver
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
