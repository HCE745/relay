"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import {
  Search, Loader2, X, ChevronLeft, ChevronDown, ChevronUp, ExternalLink,
  MapPin, Users, Zap, CheckCircle2, AlertTriangle,
  RefreshCw, Send, Building2, Star, Mail, Globe,
  Bookmark, BookmarkCheck, Trash2, FolderOpen, List,
} from "lucide-react"
import type { DiscoveredCompanyBasic, DiscoveredCompanyDetails } from "@/app/api/super-admin/crm/prospects/discover/route"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailDraft { subject: string; body: string }

type SearchState     = "idle" | "loading" | "done" | "error"
type DetailsState   = "loading" | "ready" | "error"
type EmailState     = "idle" | "loading" | "ready" | "sending" | "sent" | "error"
type SaveState      = "idle" | "saving" | "saved" | "error"
type ListSaveState  = "idle" | "naming" | "saving" | "saved" | "error"
type ActiveTab      = "search" | "lists"
type VerifState     = "pending" | "done" | "error"
type CompanyWithVerify = DiscoveredCompanyBasic & { verificationState?: VerifState }

interface SearchDiagRec {
  rawCount:     number
  filteredCount: number
  durationMs:   number
}

interface VerifyResult {
  employeeCountTier:  import("@/app/api/super-admin/crm/prospects/discover/route").EmployeeCountTier
  estimatedEmployees: string
  qualificationTier:  import("@/app/api/super-admin/crm/prospects/discover/route").QualificationTier
  locationVerified:   boolean
  sourceCitations:    string[]
}

interface ResearchList {
  id:              string
  name:            string
  description:     string | null
  isShared:        boolean
  ownedByMe:       boolean
  searchCountry:   string | null
  searchState:     string | null
  searchIndustry:  string | null
  searchEmpMin:    number | null
  searchEmpMax:    number | null
  createdAt:       string
  _count:          { results: number }
}

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch { return "" }
}

function domainFromWebsite(website: string): string | null {
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "")
  } catch { return null }
}

function suggestEmailsFromDomain(website: string): string[] {
  const domain = domainFromWebsite(website)
  if (!domain) return []
  return [`info@${domain}`, `operations@${domain}`, `contact@${domain}`, `facilities@${domain}`]
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company, selected, onClick, onVerify }: {
  company:   CompanyWithVerify
  selected:  boolean
  onClick:   () => void
  onVerify?: () => void
}) {
  const badge = fitBadge(company.fitScore)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border rounded-xl p-4 transition-all cursor-pointer ${
        selected ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-gray-800 hover:border-gray-700"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-[14px] leading-snug">{company.companyName}</h3>
            {company.qualificationTier === "qualified" && company.employeeCountTier === "web_confirmed" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50 flex-shrink-0">
                <CheckCircle2 className="w-2 h-2" />
                Size confirmed
              </span>
            )}
            {company.qualificationTier === "qualified" && company.employeeCountTier === "web_estimated" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/50 flex-shrink-0">
                <CheckCircle2 className="w-2 h-2" />
                Size estimated
              </span>
            )}
            {company.qualificationTier === "potential" && (
              company.verificationState === "pending" ? (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/50 flex-shrink-0">
                  <Loader2 className="w-2 h-2 animate-spin" />
                  Verifying...
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/50 flex-shrink-0">
                    <AlertTriangle className="w-2 h-2" />
                    Size unverified
                  </span>
                  {onVerify && company.verificationState !== "done" && (
                    <button
                      onClick={e => { e.stopPropagation(); onVerify() }}
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/50 hover:border-indigo-600/50 hover:text-indigo-400 transition-colors flex-shrink-0"
                    >
                      <RefreshCw className="w-2 h-2" />
                      {company.verificationState === "error" ? "Retry" : "Verify"}
                    </button>
                  )}
                </>
              )
            )}
            {company.qualificationTier === "location_unverified" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-800/50 flex-shrink-0">
                <AlertTriangle className="w-2 h-2" />
                Location unclear
              </span>
            )}
            {company.crmStatus === "contacted" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/30 text-orange-400 border border-orange-800/50 flex-shrink-0">
                <CheckCircle2 className="w-2 h-2" />
                Contacted {company.lastContactAt ? formatDate(company.lastContactAt) : ""}
              </span>
            )}
            {company.crmStatus === "in_crm" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/50 flex-shrink-0">
                <Building2 className="w-2 h-2" />
                In CRM
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-gray-400">
            {(company.city || company.state) && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {[company.city, company.state].filter(Boolean).join(", ")}
              </span>
            )}
            {company.estimatedEmployees && company.estimatedEmployees !== "unknown" ? (
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />{company.estimatedEmployees} emp.
                {company.employeeCountTier === "web_confirmed" && <span className="text-green-500/70">✓</span>}
                {company.employeeCountTier === "web_estimated" && <span className="text-amber-500/70">~</span>}
              </span>
            ) : company.qualificationTier !== "qualified" ? (
              <span className="flex items-center gap-0.5 text-gray-600">
                <Users className="w-2.5 h-2.5" />size unknown
              </span>
            ) : null}
            {company.website && (
              <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-indigo-400/80 hover:text-indigo-300 transition-colors"
                onClick={e => e.stopPropagation()}>
                <ExternalLink className="w-2.5 h-2.5" />{cleanUrl(company.website)}
              </a>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-lg border ${badge.bg} ${badge.border}`}>
          <span className={`text-lg font-bold leading-none tabular-nums ${badge.text}`}>{company.fitScore}</span>
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
    </button>
  )
}

// ─── Slide-over ───────────────────────────────────────────────────────────────

function SlideOver({ company, onClose }: {
  company: DiscoveredCompanyBasic
  onClose: () => void
}) {
  const badge = fitBadge(company.fitScore)

  const suggestedEmails = useMemo(() => company.website ? suggestEmailsFromDomain(company.website) : [], [company.website])

  const [detailsState, setDetailsState] = useState<DetailsState>("loading")
  const [details,      setDetails]      = useState<DiscoveredCompanyDetails | null>(null)
  const [detailsErr,   setDetailsErr]   = useState<string | null>(null)

  const [emailState,  setEmailState]  = useState<EmailState>("idle")
  const [draft,       setDraft]       = useState<EmailDraft | null>(null)
  const [toEmail,     setToEmail]     = useState(suggestedEmails[0] ?? "")
  const [subject,     setSubject]     = useState("")
  const [emailBody,   setEmailBody]   = useState("")
  const [emailError,  setEmailError]  = useState<string | null>(null)
  const [sentIds,     setSentIds]     = useState<{ prospectId: string; demoCallId: string } | null>(null)
  const [duplicate,   setDuplicate]   = useState<DuplicateInfo | null>(null)
  const [saveState,   setSaveState]   = useState<SaveState>("idle")

  const generateEmail = useCallback(async (detailsData: DiscoveredCompanyDetails) => {
    setEmailState("loading")
    setEmailError(null)
    setDuplicate(null)
    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ company: detailsData }),
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
  }, [])

  // On open: fetch details (email generation is explicit, not automatic)
  useEffect(() => {
    const ctrl = new AbortController()
    async function fetchDetails() {
      setDetailsState("loading")
      setDetailsErr(null)
      setEmailState("idle")
      setDraft(null)
      try {
        const res = await fetch("/api/super-admin/crm/prospects/discover/details", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ company }),
          signal:  ctrl.signal,
        })
        if (!res.ok) throw new Error(`Details failed (${res.status})`)
        const data = await res.json() as DiscoveredCompanyDetails
        setDetails(data)
        setDetailsState("ready")
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        const msg = err instanceof Error ? err.message : "Failed to load research"
        setDetailsErr(msg)
        setDetailsState("error")
      }
    }
    void fetchDetails()
    return () => ctrl.abort()
  }, [company.companyName])

  async function handleSend(force = false) {
    if (!toEmail.trim()) { setEmailError("Enter a recipient email address"); return }
    if (emailState === "sending") return
    const payload = details ?? { ...company, painPoints: [], relayFitReasons: [], suggestedOutreachAngle: "" }
    setEmailState("sending")
    setEmailError(null)
    setDuplicate(null)
    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ company: payload, to: toEmail.trim(), subject, emailBody, force }),
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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          companyName:      company.companyName,
          website:          company.website || null,
          industry:         company.industry || null,
          headquartersCity:  company.city || null,
          headquartersState: company.state || null,
          source:           "ai_research",
        }),
      })
      if (res.status === 409) { setSaveState("saved"); return }
      if (!res.ok) throw new Error("Save failed")
      setSaveState("saved")
    } catch { setSaveState("error") }
  }

  const canSend = emailState === "ready" || emailState === "sending"
  const websiteHref = company.website
    ? (company.website.startsWith("http") ? company.website : `https://${company.website}`)
    : null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full sm:w-[520px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-semibold text-base leading-snug">{company.companyName}</h2>
              {company.crmStatus === "contacted" && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/30 text-orange-400 border border-orange-800/50">
                  <CheckCircle2 className="w-2 h-2" />
                  Contacted {company.lastContactAt ? formatDate(company.lastContactAt) : ""}
                </span>
              )}
              {company.crmStatus === "in_crm" && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/50">
                  <Building2 className="w-2 h-2" />
                  In CRM
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-1.5">
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
              {websiteHref && (
                <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  onClick={e => e.stopPropagation()}>
                  <Globe className="w-3 h-3" />{cleanUrl(company.website)}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-lg border ${badge.bg} ${badge.border}`}>
              <span className={`text-lg font-bold tabular-nums ${badge.text}`}>{company.fitScore}</span>
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
              <p className="text-sm text-gray-300 leading-relaxed">{company.summary}</p>
            )}

            {/* Research section */}
            {detailsState === "loading" && (
              <div className="space-y-3 animate-pulse">
                <div className="h-3 bg-gray-800 rounded w-32" />
                <div className="space-y-2">
                  <div className="h-3 bg-gray-800 rounded w-full" />
                  <div className="h-3 bg-gray-800 rounded w-4/5" />
                  <div className="h-3 bg-gray-800 rounded w-full" />
                </div>
              </div>
            )}

            {detailsState === "error" && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Research failed: {detailsErr}</span>
              </div>
            )}

            {detailsState === "ready" && details && (
              <>
                {/* Pain Points */}
                {details.painPoints?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Operational Pain Points</p>
                    <ul className="space-y-1.5">
                      {details.painPoints.map((p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-amber-300/80">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Relay Fit */}
                {details.relayFitReasons?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Why Relay Fits</p>
                    <ul className="space-y-1.5">
                      {details.relayFitReasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Star className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-300">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Outreach Angle */}
                {details.suggestedOutreachAngle && (
                  <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-lg px-3.5 py-2.5">
                    <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Outreach Angle</p>
                    <p className="text-sm text-indigo-200/80">{details.suggestedOutreachAngle}</p>
                  </div>
                )}
              </>
            )}

            {/* ── Email Draft ──────────────────────────────────────────────── */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Outreach Email
                </p>
                {details && emailState === "ready" && (
                  <button onClick={() => void generateEmail(details)}
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
                  {/* Email loading */}
                  {emailState === "loading" && (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-8 bg-gray-800 rounded-lg" />
                      <div className="h-32 bg-gray-800 rounded-lg" />
                    </div>
                  )}

                  {/* Email error */}
                  {emailState === "error" && (
                    <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {emailError ?? "Failed to generate email"}
                    </div>
                  )}

                  {/* Generate email button (shown before user requests a draft) */}
                  {emailState === "idle" && detailsState === "ready" && details && (
                    <button
                      onClick={() => void generateEmail(details)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      <Mail className="w-4 h-4" /> Generate email draft
                    </button>
                  )}

                  {/* Draft ready */}
                  {(emailState === "ready" || emailState === "sending") && (
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
                                <button onClick={() => { setDuplicate(null); void handleSend(true) }}
                                  className="underline hover:text-amber-200">Send anyway</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Suggested emails */}
                      {suggestedEmails.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            Suggested contact emails — not verified
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {suggestedEmails.map(e => (
                              <button key={e} onClick={() => setToEmail(e)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                  toEmail === e
                                    ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                                }`}>
                                {e}
                              </button>
                            ))}
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
                      {draft && (
                        <>
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">Subject</label>
                            <input
                              type="text"
                              value={subject}
                              onChange={e => setSubject(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">Body</label>
                            <textarea
                              rows={10}
                              value={emailBody}
                              onChange={e => setEmailBody(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white leading-relaxed focus:outline-none focus:border-indigo-500 transition-colors resize-none font-mono"
                            />
                          </div>
                        </>
                      )}

                      {/* Error (non-duplicate) */}
                      {emailError && !duplicate && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />{emailError}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => void handleSend()}
                          disabled={!canSend || !draft}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {emailState === "sending"
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                            : <><Send className="w-4 h-4" /> Send Now</>
                          }
                        </button>
                        <button
                          onClick={() => void handleSaveOnly()}
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

// ─── Saved Lists Tab ─────────────────────────────────────────────────────────

function SavedListsTab({ onLoad }: { onLoad: (companies: DiscoveredCompanyBasic[], listName: string) => void }) {
  const [lists, setLists]     = useState<ResearchList[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch("/api/super-admin/crm/prospects/discover/lists")
      .then(r => r.json())
      .then(d => { setLists(d as ResearchList[]); setLoading(false) })
      .catch(() => { setError("Failed to load saved lists"); setLoading(false) })
  }, [])

  async function handleDelete(id: string) {
    if (!confirm("Delete this research list? Results already promoted to CRM will be preserved.")) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setLists(prev => prev?.filter(l => l.id !== id) ?? null)
    } catch { alert("Could not delete list") }
    finally { setDeleting(null) }
  }

  async function handleLoad(list: ResearchList) {
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${list.id}`)
      if (!res.ok) throw new Error("Load failed")
      const data = await res.json() as { results: (DiscoveredCompanyBasic & { verifiedCity?: string; verifiedState?: string; verifiedCountry?: string; employeeCountSource?: string })[] }
      // Map ProspectResearchResult shape back to DiscoveredCompanyBasic.
      // DB stores employeeCountTier as "employeeCountSource" — read both for forward/back compat.
      const companies: DiscoveredCompanyBasic[] = data.results.map(r => {
        const empTier = ((r.employeeCountSource ?? r.employeeCountTier ?? "unknown") as import("@/app/api/super-admin/crm/prospects/discover/route").EmployeeCountTier)
        return {
        companyName:        r.companyName,
        website:            r.website ?? "",
        city:               r.verifiedCity ?? r.city ?? "",
        state:              r.verifiedState ?? r.state ?? "",
        country:            r.verifiedCountry ?? r.country ?? "United States",
        industry:           r.industry ?? "",
        estimatedEmployees: r.estimatedEmployees ?? "",
        employeeCountTier:  empTier,
        qualificationTier:  r.qualificationTier  ?? (empTier !== "unknown" ? "qualified" : "potential"),
        sourceCitations:    r.sourceCitations     ?? [],
        locationVerified:   r.locationVerified    ?? false,
        summary:            r.summary ?? "",
        fitScore:           r.fitScore ?? 50,
        crmStatus:          r.crmStatus ?? "none",
        lastContactAt:      r.lastContactAt ?? undefined,
      }
      })
      onLoad(companies, list.name)
    } catch { alert("Could not load list") }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-48 text-sm text-red-400">{error}</div>
  )

  if (!lists || lists.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-8">
      <FolderOpen className="w-10 h-10 text-gray-700 mb-3" />
      <p className="text-gray-400 font-medium mb-1">No saved lists yet</p>
      <p className="text-sm text-gray-600">Run a search and use &quot;Save to list&quot; to preserve your results.</p>
    </div>
  )

  return (
    <div className="p-4 space-y-3">
      {lists.map(list => (
        <div key={list.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-semibold text-sm">{list.name}</h3>
                {list.isShared && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/50">
                    Shared
                  </span>
                )}
                {!list.ownedByMe && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">
                    Read-only
                  </span>
                )}
              </div>
              {/* Search criteria chips */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {list.searchCountry && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                    {list.searchCountry}
                  </span>
                )}
                {list.searchState && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-800/50">
                    {list.searchState}
                  </span>
                )}
                {list.searchIndustry && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                    {list.searchIndustry}
                  </span>
                )}
                {(list.searchEmpMin || list.searchEmpMax) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                    {list.searchEmpMin ?? "any"}–{list.searchEmpMax ?? "any"} emp
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {list._count.results} {list._count.results === 1 ? "company" : "companies"} · saved {formatDate(list.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => void handleLoad(list)}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-800/50 rounded-lg transition-colors"
              >
                <List className="w-3 h-3" /> Load
              </button>
              {list.ownedByMe && (
                <button
                  onClick={() => void handleDelete(list.id)}
                  disabled={deleting === list.id}
                  className="p-1.5 text-gray-600 hover:text-red-400 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {deleting === list.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  "Manufacturing", "Food & Beverage", "Warehousing & Logistics",
  "Retail", "Healthcare", "Hospitality", "Construction",
  "Property Management", "Education",
]

const COUNTRY_OPTIONS = [
  { value: "United States", label: "United States" },
  { value: "Canada",        label: "Canada" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Australia",     label: "Australia" },
  { value: "Other",         label: "Other" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [discoveryEnabled, setDiscoveryEnabled] = useState<boolean | null>(null)
  const [activeTab,        setActiveTab]        = useState<ActiveTab>("search")

  const [country,       setCountry]       = useState("United States")
  const [stateProvince, setStateProvince] = useState("")
  const [industry,      setIndustry]      = useState("")
  const [empMin,        setEmpMin]        = useState("")
  const [empMax,        setEmpMax]        = useState("")
  const [locMin,        setLocMin]        = useState("")
  const [keywords,      setKeywords]      = useState("")
  const [context,       setContext]       = useState("")

  const [searchState,    setSearchState]    = useState<SearchState>("idle")
  const [companies,      setCompanies]      = useState<CompanyWithVerify[]>([])
  const [searchError,    setSearchError]    = useState<string | null>(null)
  const [selected,       setSelected]       = useState<CompanyWithVerify | null>(null)
  const [limitationNote, setLimitationNote] = useState<string | null>(null)

  const [listSaveState, setListSaveState] = useState<ListSaveState>("idle")
  const [listName,      setListName]      = useState("")
  const [listSaveError, setListSaveError] = useState<string | null>(null)

  const sessionVerifyCountRef = useRef(0)
  const searchAbortRef        = useRef<AbortController | null>(null)
  const jobListAcceptedRef    = useRef(0)
  const [diagRec,   setDiagRec]   = useState<SearchDiagRec | null>(null)
  const [diagsOpen, setDiagsOpen] = useState(false)

  // Research-job state (persisted in sessionStorage so Rachel can leave and return)
  const [activeJobId,          setActiveJobId]          = useState<string | null>(null)
  const [activeListId,         setActiveListId]         = useState<string | null>(null)
  const [jobRoundsCompleted,   setJobRoundsCompleted]   = useState(0)
  const [jobRoundsMax,         setJobRoundsMax]         = useState(5)
  const [activeJobStatus,      setActiveJobStatus]      = useState<string>("idle")

  // Restore in-flight job from sessionStorage on mount
  useEffect(() => {
    try {
      const jid  = sessionStorage.getItem("discover_job_id")
      const lid  = sessionStorage.getItem("discover_list_id")
      const stat = sessionStorage.getItem("discover_job_status") ?? "idle"
      if (jid && ["pending", "running"].includes(stat)) {
        setActiveJobId(jid)
        if (lid) setActiveListId(lid)
        setActiveJobStatus(stat)
        setSearchState("done")
      }
    } catch { /* sessionStorage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll job status while research is running
  useEffect(() => {
    if (!activeJobId || !["pending", "running"].includes(activeJobStatus)) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/super-admin/crm/prospects/discover/jobs/${activeJobId}`)
        if (!res.ok) return
        const job = await res.json() as {
          status: string; roundsCompleted: number; roundsMax: number
          acceptedCount: number; listId: string | null; lastError: string | null
        }
        setJobRoundsCompleted(job.roundsCompleted)
        setJobRoundsMax(job.roundsMax)
        try { sessionStorage.setItem("discover_job_status", job.status) } catch { /* ignore */ }

        if (job.acceptedCount > jobListAcceptedRef.current && job.listId) {
          jobListAcceptedRef.current = job.acceptedCount
          const lr = await fetch(`/api/super-admin/crm/prospects/discover/lists/${job.listId}`)
          if (lr.ok) {
            const data = await lr.json() as {
              results: Array<{
                companyName: string; website: string | null; verifiedCity: string | null
                verifiedState: string | null; verifiedCountry: string | null
                industry: string | null; estimatedEmployees: string | null
                employeeCountSource: string | null; qualificationTier?: string
                sourceCitations: string[]; locationVerified: boolean
                summary: string | null; fitScore: number | null; crmStatus?: string
              }>
            }
            const listCompanies: CompanyWithVerify[] = data.results.map(r => {
              const empTier = (r.employeeCountSource ?? "unknown") as import("@/app/api/super-admin/crm/prospects/discover/route").EmployeeCountTier
              return {
                companyName:        r.companyName,
                website:            r.website            ?? "",
                city:               r.verifiedCity       ?? "",
                state:              r.verifiedState      ?? "",
                country:            r.verifiedCountry    ?? "United States",
                industry:           r.industry           ?? "",
                estimatedEmployees: r.estimatedEmployees ?? "",
                employeeCountTier:  empTier,
                qualificationTier:  (r.locationVerified && empTier !== "unknown" ? "qualified" : r.locationVerified ? "potential" : "location_unverified") as import("@/app/api/super-admin/crm/prospects/discover/route").QualificationTier,
                sourceCitations:    r.sourceCitations    ?? [],
                locationVerified:   r.locationVerified,
                summary:            r.summary            ?? "",
                fitScore:           r.fitScore           ?? 50,
                crmStatus:          "none" as const,
                // preserve any existing verificationState for already-displayed companies
                verificationState:  undefined,
              }
            })
            setCompanies(prev => {
              const prevByName = new Map(prev.map(c => [c.companyName, c]))
              return listCompanies.map(c => ({ ...c, verificationState: prevByName.get(c.companyName)?.verificationState }))
            })
            const newOnes = listCompanies.filter(c => !companies.some(e => e.companyName === c.companyName))
            if (newOnes.length > 0) autoVerifyFromSession(newOnes)
          }
        }

        if (["completed", "failed", "cancelled"].includes(job.status)) {
          setActiveJobStatus(job.status)
          clearInterval(interval)
          if (job.status === "failed" && job.lastError) {
            setLimitationNote(`Research stopped after round ${job.roundsCompleted}: ${job.lastError}`)
          }
        } else {
          setActiveJobStatus(job.status)
        }
      } catch { /* ignore polling errors */ }
    }, 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, activeJobStatus])

  async function handleSaveToList() {
    if (!listName.trim()) return
    setListSaveState("saving")
    setListSaveError(null)
    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/lists", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:           listName.trim(),
          searchCountry:  country       || null,
          searchState:    stateProvince || null,
          searchIndustry: industry      || null,
          searchEmpMin:   empMin        ? parseInt(empMin,  10) : null,
          searchEmpMax:   empMax        ? parseInt(empMax,  10) : null,
          searchKeywords: keywords      || null,
          searchContext:  context       || null,
          results:        companies.map(c => ({
            companyName:        c.companyName,
            website:            c.website,
            city:               c.city,
            state:              c.state,
            country:            c.country,
            industry:           c.industry,
            estimatedEmployees: c.estimatedEmployees,
            employeeCountTier:  c.employeeCountTier,
            sourceCitations:    c.sourceCitations,
            summary:            c.summary,
            fitScore:           c.fitScore,
          })),
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      setListSaveState("saved")
      setListName("")
    } catch (err) {
      setListSaveError(err instanceof Error ? err.message : "Save failed")
      setListSaveState("error")
    }
  }

  function handleLoadList(loadedCompanies: DiscoveredCompanyBasic[], loadedName: string) {
    setCompanies(loadedCompanies as CompanyWithVerify[])
    setSearchState("done")
    setActiveTab("search")
    setListName(loadedName)
    setListSaveState("saved") // it's already saved
  }

  async function verifyCompany(company: CompanyWithVerify) {
    if (company.verificationState === "pending" || company.verificationState === "done") return

    setCompanies(prev => prev.map(c =>
      c.companyName === company.companyName ? { ...c, verificationState: "pending" as VerifState } : c
    ))

    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          companyName:      company.companyName,
          website:          company.website,
          empMin:           empMin ? parseInt(empMin,  10) : 50,
          empMax:           empMax ? parseInt(empMax, 10) : 300,
          locationVerified: company.locationVerified,
        }),
      })
      if (!res.ok) throw new Error(`Verification failed (${res.status})`)
      const result = await res.json() as VerifyResult

      setCompanies(prev => prev.map(c =>
        c.companyName === company.companyName
          ? {
              ...c,
              employeeCountTier:  result.employeeCountTier,
              estimatedEmployees: result.estimatedEmployees,
              qualificationTier:  result.qualificationTier,
              sourceCitations:    [...new Set([...c.sourceCitations, ...result.sourceCitations])],
              verificationState:  "done" as VerifState,
            }
          : c
      ))
      setSelected(prev =>
        prev?.companyName === company.companyName
          ? { ...prev, ...result, verificationState: "done" as VerifState }
          : prev
      )
    } catch {
      setCompanies(prev => prev.map(c =>
        c.companyName === company.companyName ? { ...c, verificationState: "error" as VerifState } : c
      ))
    }
  }

  function autoVerifyFromSession(cos: CompanyWithVerify[]) {
    const remaining = 5 - sessionVerifyCountRef.current
    if (remaining <= 0) return
    const queue = [...cos]
      .filter(c => c.qualificationTier !== "location_unverified" && !c.verificationState)
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, remaining)
    // Max 2 concurrent verify calls; each worker pulls the next item from the queue
    async function drain(): Promise<void> {
      if (sessionVerifyCountRef.current >= 5) return
      const c = queue.shift()
      if (!c) return
      sessionVerifyCountRef.current++
      await verifyCompany(c)
      await drain()
    }
    const concurrency = Math.min(2, queue.length)
    void Promise.all(Array.from({ length: concurrency }, drain))
  }

  // Load enabled/disabled setting from CRM settings
  useEffect(() => {
    fetch("/api/super-admin/crm/settings")
      .then(r => r.json())
      .then(d => {
        const enabled = (d as { settings?: { aiProspectDiscoveryEnabled?: boolean } }).settings?.aiProspectDiscoveryEnabled
        setDiscoveryEnabled(enabled !== false)
      })
      .catch(() => setDiscoveryEnabled(true))
  }, [])

  const stateLabel = country === "Canada" ? "Province" : country === "United States" ? "State" : "Region"

  function handleStopSearch() {
    searchAbortRef.current?.abort()
    // Also cancel an in-flight background job
    if (activeJobId && ["pending", "running"].includes(activeJobStatus)) {
      void fetch(`/api/super-admin/crm/prospects/discover/jobs/${activeJobId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      setActiveJobStatus("cancelled")
      try { sessionStorage.removeItem("discover_job_id"); sessionStorage.removeItem("discover_list_id") } catch { /* ignore */ }
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()

    searchAbortRef.current?.abort()
    const ctrl = new AbortController()
    searchAbortRef.current = ctrl

    sessionVerifyCountRef.current = 0
    jobListAcceptedRef.current    = 0

    setSearchState("loading")
    setSearchError(null)
    setCompanies([])
    setSelected(null)
    setLimitationNote(null)
    setListSaveState("idle")
    setListName("")
    setDiagRec(null)
    setDiagsOpen(false)
    setActiveJobId(null)
    setActiveListId(null)
    setActiveJobStatus("idle")
    setJobRoundsCompleted(0)

    const startMs = Date.now()
    const body: Record<string, unknown> = { country, requestedCount: 20 }
    if (stateProvince) body.stateProvince    = stateProvince
    if (industry)      body.industry         = industry
    if (empMin)        body.employeeCountMin  = parseInt(empMin,  10)
    if (empMax)        body.employeeCountMax  = parseInt(empMax,  10)
    if (keywords)      body.keywords          = keywords
    if (context)       body.additionalContext = context

    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/jobs", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Search failed (${res.status})`)
      }

      const data = await res.json() as {
        companies:      DiscoveredCompanyBasic[]
        filteredCount?: number
        rawCount?:      number
        limitationNote?: string
        jobId?:         string
        listId?:        string
        jobStatus?:     string
        roundsCompleted?: number
        roundsMax?:     number
      }

      const found = (data.companies ?? []) as CompanyWithVerify[]
      setCompanies(found)
      setLimitationNote(data.limitationNote ?? null)

      const rec: SearchDiagRec = {
        rawCount:     data.rawCount      ?? found.length,
        filteredCount: data.filteredCount ?? 0,
        durationMs:   Date.now() - startMs,
      }
      setDiagRec(rec)
      if (found.length === 0 && rec.filteredCount > 0) setDiagsOpen(true)

      if (data.jobId) {
        setActiveJobId(data.jobId)
        if (data.listId) {
          setActiveListId(data.listId)
          setListSaveState("saved") // already saved to list by server
          try {
            sessionStorage.setItem("discover_job_id",     data.jobId)
            sessionStorage.setItem("discover_list_id",    data.listId)
            sessionStorage.setItem("discover_job_status", data.jobStatus ?? "pending")
          } catch { /* ignore */ }
        }
        setJobRoundsCompleted(data.roundsCompleted ?? 1)
        setJobRoundsMax(data.roundsMax ?? 5)
        setActiveJobStatus(data.jobStatus ?? "pending")
        jobListAcceptedRef.current = found.length
      }

      setSearchState("done")
      autoVerifyFromSession(found)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setSearchError(err instanceof Error ? err.message : "Search failed")
      setSearchState("error")
    }
  }

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
  const labelCls = "block text-[11px] font-medium text-gray-400 mb-1.5"

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link href="/super-admin/crm/prospects"
          className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white">Prospect Discovery</h1>
          <p className="text-[11px] text-gray-500">AI-powered search for new sales prospects</p>
        </div>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "search"
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Search className="w-3 h-3" /> Search
          </button>
          <button
            onClick={() => setActiveTab("lists")}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "lists"
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Bookmark className="w-3 h-3" /> Saved Lists
          </button>
        </div>
      </div>

      {/* Saved Lists Tab */}
      {activeTab === "lists" && (
        <div className="h-[calc(100vh-57px)] overflow-y-auto">
          <SavedListsTab onLoad={handleLoadList} />
        </div>
      )}

      <div className={`flex h-[calc(100vh-57px)] ${activeTab !== "search" ? "hidden" : ""}`}>
        {/* ── Left: Search form ─────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
          <form onSubmit={handleSearch} className="p-4 space-y-3">

            {/* Country — first filter */}
            <div>
              <label className={labelCls}>Country</label>
              <select value={country} onChange={e => { setCountry(e.target.value); setStateProvince("") }}
                className={inputCls}>
                {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* State / Province — shown for all but Other */}
            {country !== "Other" && (
              <div>
                <label className={labelCls}>{stateLabel}</label>
                <input type="text"
                  placeholder={country === "Canada" ? "e.g. Ontario, BC" : "e.g. Texas, Midwest"}
                  value={stateProvince} onChange={e => setStateProvince(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            {country === "Other" && (
              <div>
                <label className={labelCls}>Region / Location</label>
                <input type="text" placeholder="e.g. Southeast Asia, Germany"
                  value={stateProvince} onChange={e => setStateProvince(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Industry</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)} className={inputCls}>
                <option value="">Any industry</option>
                {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Employee Count</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={empMin} onChange={e => setEmpMin(e.target.value)}
                  className={inputCls} />
                <input type="number" placeholder="Max" value={empMax} onChange={e => setEmpMax(e.target.value)}
                  className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Min. Locations</label>
              <input type="number" placeholder="e.g. 3" value={locMin} onChange={e => setLocMin(e.target.value)}
                className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Keywords</label>
              <input type="text" placeholder="e.g. warehousing, cold storage" value={keywords}
                onChange={e => setKeywords(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Additional Context</label>
              <textarea rows={3} placeholder="Any other targeting details..." value={context}
                onChange={e => setContext(e.target.value)}
                className={`${inputCls} resize-none`} />
            </div>

            {discoveryEnabled === false ? (
              <div>
                <button
                  type="button"
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 opacity-50 cursor-not-allowed text-gray-400 text-sm font-medium rounded-lg"
                >
                  <Search className="w-4 h-4" /> Find Prospects
                </button>
                <p className="text-[11px] text-amber-500/80 text-center mt-2 leading-snug">
                  AI prospect discovery is currently disabled. Enable it in{" "}
                  <Link href="/super-admin/crm/settings" className="underline hover:text-amber-400">CRM Settings</Link>{" "}
                  or add prospects manually.
                </p>
              </div>
            ) : (
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
            )}

            {searchState === "loading" && (
              <p className="text-[11px] text-gray-500 text-center">Starting research job…</p>
            )}
          </form>
        </div>

        {/* ── Right: Results ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── Search Diagnostics (admin only) ─────────────────── */}
          {diagRec && (
            <div className="mb-4 bg-gray-900/60 border border-gray-700/40 rounded-xl overflow-hidden">
              <button
                onClick={() => setDiagsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Search Diagnostics</span>
                  <span className="text-[10px] text-gray-600">· {companies.length} shown</span>
                  {diagRec.filteredCount > 0 && (
                    <span className="text-[10px] text-amber-500/80">· {diagRec.filteredCount} filtered by CRM</span>
                  )}
                </div>
                {diagsOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  : <ChevronDown className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                }
              </button>
              {diagsOpen && (
                <div className="border-t border-gray-800 font-mono text-[10px] px-4 py-2.5">
                  <div className="grid grid-cols-4 gap-x-6">
                    <div><span className="text-gray-600">found </span><span className="text-gray-300">{diagRec.rawCount}</span></div>
                    <div><span className="text-gray-600">crm </span><span className={diagRec.filteredCount > 0 ? "text-amber-400" : "text-gray-300"}>{diagRec.filteredCount}</span></div>
                    <div><span className="text-gray-600">net </span><span className={companies.length > 0 ? "text-green-400" : "text-amber-400"}>{companies.length}</span></div>
                    <div><span className="text-gray-600">time </span><span className="text-gray-300">{(diagRec.durationMs / 1000).toFixed(1)}s</span></div>
                  </div>
                  {diagRec.filteredCount > 0 && diagRec.filteredCount === diagRec.rawCount && (
                    <p className="text-amber-400/70 text-[10px] mt-1.5 font-sans">All companies Claude found are already in the CRM. Try different keywords or a different location.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {searchState === "idle" && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <Search className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium mb-1">Find sales prospects</p>
              <p className="text-sm text-gray-600">
                Choose a country and fill in your criteria. Claude will return 8-10 real companies — click any card to load full research and generate a personalized outreach email.
              </p>
            </div>
          )}

          {searchState === "loading" && (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-gray-400 font-medium">Starting research job…</p>
              <p className="text-sm text-gray-600 mt-1">Creating the list and queuing round 1</p>
              <button
                onClick={handleStopSearch}
                className="mt-4 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded border border-red-900/50 hover:border-red-800 transition-colors"
              >
                Stop
              </button>
            </div>
          )}

          {searchState === "error" && (
            <div className="flex items-center justify-center py-16">
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-6 text-center max-w-sm">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-300 font-medium mb-1">Search failed</p>
                <p className="text-sm text-red-400/70">{searchError}</p>
              </div>
            </div>
          )}

          {searchState === "done" && (
            <>
              {limitationNote && (
                <div className="mb-4 flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3.5 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-300/90 leading-relaxed">{limitationNote}</p>
                </div>
              )}
              {/* Job progress banner */}
              {activeJobId && ["pending", "running"].includes(activeJobStatus) && (
                <div className="mb-3 flex items-center gap-2 bg-indigo-950/40 border border-indigo-800/40 rounded-lg px-3.5 py-2 text-[12px]">
                  <Loader2 className="w-3 h-3 text-indigo-400 animate-spin flex-shrink-0" />
                  <span className="text-indigo-300">
                    Research continuing — round {jobRoundsCompleted} of up to {jobRoundsMax} complete, more companies arriving shortly
                  </span>
                  <button
                    onClick={handleStopSearch}
                    className="ml-auto text-[11px] text-red-400/70 hover:text-red-400 flex-shrink-0"
                  >
                    Stop
                  </button>
                </div>
              )}
              {activeJobId && activeJobStatus === "completed" && (
                <div className="mb-3 flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3.5 py-2 text-[12px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-emerald-300">Research complete — {jobRoundsCompleted} rounds, {companies.length} companies found</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-300 font-medium">
                    Found {companies.length} {companies.length === 1 ? "company" : "companies"}
                    {companies.some(c => c.crmStatus !== "none") && (
                      <span className="text-[11px] text-gray-500 ml-2 font-normal">
                        · {companies.filter(c => c.crmStatus !== "none").length} flagged in CRM
                      </span>
                    )}
                  </p>
                  {/* Applied filters summary */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                      {country}
                    </span>
                    {stateProvince && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-800/50">
                        {stateProvince}
                      </span>
                    )}
                    {industry && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                        {industry}
                      </span>
                    )}
                    {(empMin || empMax) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                        {empMin || "any"}–{empMax || "any"} emp
                      </span>
                    )}
                  </div>
                </div>
                {companies.length > 0 && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-[11px] text-gray-500 hidden sm:block">Click a card to research + draft email</p>
                    {/* When from a research job, results are auto-saved; show a link to the list */}
                    {activeListId ? (
                      <button
                        onClick={() => setActiveTab("lists")}
                        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 rounded-lg transition-colors"
                      >
                        <BookmarkCheck className="w-3 h-3" /> Saved to list
                      </button>
                    ) : listSaveState === "saved" ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <BookmarkCheck className="w-3.5 h-3.5" /> Saved
                      </span>
                    ) : listSaveState === "naming" || listSaveState === "saving" || listSaveState === "error" ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          placeholder="List name…"
                          value={listName}
                          onChange={e => setListName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") void handleSaveToList(); if (e.key === "Escape") { setListSaveState("idle"); setListName("") } }}
                          className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 w-36"
                        />
                        <button
                          onClick={() => void handleSaveToList()}
                          disabled={!listName.trim() || listSaveState === "saving"}
                          className="text-[11px] px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {listSaveState === "saving" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </button>
                        <button onClick={() => { setListSaveState("idle"); setListName("") }} className="text-gray-500 hover:text-gray-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {listSaveState === "error" && listSaveError && (
                          <span className="text-[10px] text-red-400">{listSaveError}</span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setListSaveState("naming")}
                        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors"
                      >
                        <Bookmark className="w-3 h-3" /> Save to list
                      </button>
                    )}
                  </div>
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
                    onVerify={() => void verifyCompany(c)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Slide-over — key ensures remount on company switch, not just on prop update */}
      {selected && (
        <SlideOver
          key={selected.companyName}
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
