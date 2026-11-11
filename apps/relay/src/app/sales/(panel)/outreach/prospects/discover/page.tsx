"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import {
  Search, Loader2, X, ChevronLeft, ChevronDown, ChevronUp, ExternalLink,
  MapPin, Users, Zap, CheckCircle2, AlertTriangle,
  Building2, Star, Mail, Globe, User, Plus, Send,
  Phone, Link2, FileText, Calendar, Clock,
} from "lucide-react"
import type { DiscoveredCompanyBasic, DiscoveredCompanyDetails } from "@/app/api/super-admin/crm/prospects/discover/route"

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchState  = "idle" | "loading" | "done" | "error"
type DetailsState = "loading" | "ready" | "error"
type PanelStep    = "contact" | "action" | "email" | "log"

interface ContactDraft {
  name:     string
  title:    string
  email:    string
  phone:    string
  linkedin: string
  notes:    string
}

interface Template { id: string; name: string; subject: string; body: string }

interface ProspectCreated {
  prospectId: string
  contactId:  string | null
  contactEmail: string
}

interface SavedContact {
  id:         string
  name:       string
  email:      string
  prospectId: string
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
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
  catch { return "" }
}

function applyMergeFields(text: string, ctx: { companyName: string; city?: string; firstName?: string }): string {
  return text
    .replace(/\{\{companyName\}\}/g, ctx.companyName)
    .replace(/\{\{city\}\}/g, ctx.city ?? "")
    .replace(/\{\{firstName\}\}/g, ctx.firstName ?? "")
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company, selected, onClick }: {
  company:  DiscoveredCompanyBasic
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
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-[14px] leading-snug">{company.companyName}</h3>
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
            {company.estimatedEmployees && (
              <span className="flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />{company.estimatedEmployees} emp.
              </span>
            )}
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
  const websiteHref = company.website
    ? (company.website.startsWith("http") ? company.website : `https://${company.website}`)
    : null

  // Company research
  const [detailsState, setDetailsState] = useState<DetailsState>("loading")
  const [details,      setDetails]      = useState<DiscoveredCompanyDetails | null>(null)
  const [detailsErr,   setDetailsErr]   = useState<string | null>(null)

  // Accordion sections — all independent, contact open by default
  const [sectionOpen, setSectionOpen] = useState({ contact: true, outreach: false, contacts: false })
  function toggleSection(s: "contact" | "outreach" | "contacts") {
    setSectionOpen(prev => ({ ...prev, [s]: !prev[s] }))
  }

  // Saved contacts for this session
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([])
  const [created, setCreated]             = useState<ProspectCreated | null>(null)

  // Contact form
  const blankContact = (): ContactDraft => ({ name: "", title: "", email: "", phone: "", linkedin: "", notes: "" })
  const [contact, setContact]           = useState<ContactDraft>(blankContact())
  const [savingContact, setSavingContact] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [lastSaved, setLastSaved]       = useState<string | null>(null)

  // Outreach
  type OutreachTab = "email" | "log" | "followup"
  const [outreachTab, setOutreachTab]           = useState<OutreachTab>("email")
  const [outreachContactId, setOutreachContactId] = useState<string>("")

  // Follow-up task
  const [followupTitle, setFollowupTitle]     = useState("")
  const [followupDueAt, setFollowupDueAt]     = useState("")
  const [followupNotes, setFollowupNotes]     = useState("")
  const [followupPriority, setFollowupPriority] = useState("normal")
  const [savingFollowup, setSavingFollowup]   = useState(false)
  const [followupError, setFollowupError]     = useState<string | null>(null)
  const [followupSaved, setFollowupSaved]     = useState(false)

  // Templates
  const [templates, setTemplates]           = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")

  // Email
  const [emailTo, setEmailTo]           = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody]       = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError]     = useState<string | null>(null)
  const [emailSent, setEmailSent]       = useState(false)

  // Log
  const [logType, setLogType]       = useState("CALL_CONNECTED")
  const [logOutcome, setLogOutcome] = useState("")
  const [logDuration, setLogDuration] = useState("")
  const [logNotes, setLogNotes]     = useState("")
  const [savingLog, setSavingLog]   = useState(false)
  const [logError, setLogError]     = useState<string | null>(null)
  const [logSaved, setLogSaved]     = useState(false)

  // Load company research
  useEffect(() => {
    async function fetchDetails() {
      setDetailsState("loading")
      setDetailsErr(null)
      try {
        const res = await fetch("/api/super-admin/crm/prospects/discover/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company }),
        })
        if (!res.ok) throw new Error(`Details failed (${res.status})`)
        const data = await res.json() as DiscoveredCompanyDetails
        setDetails(data)
        setDetailsState("ready")
      } catch (err) {
        setDetailsErr(err instanceof Error ? err.message : "Failed to load research")
        setDetailsState("error")
      }
    }
    void fetchDetails()
  }, [company])

  // Load templates when outreach section first opens
  useEffect(() => {
    if (!sectionOpen.outreach || templates.length > 0) return
    fetch("/api/sales/templates")
      .then(r => r.ok ? r.json() : { templates: [] })
      .then((d: { templates: Template[] }) => setTemplates(d.templates ?? []))
      .catch(() => {})
  }, [sectionOpen.outreach, templates.length])

  const applyTemplate = useCallback((templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId)
    if (!tmpl) return
    const sc = savedContacts.find(c => c.id === outreachContactId) ?? savedContacts[0]
    const ctx = {
      companyName: company.companyName,
      city: company.city ?? "",
      firstName: sc?.name.split(" ")[0] ?? "",
    }
    setEmailSubject(applyMergeFields(tmpl.subject, ctx))
    setEmailBody(applyMergeFields(tmpl.body, ctx))
    setSelectedTemplate(templateId)
  }, [templates, company, savedContacts, outreachContactId])

  async function handleSaveContact() {
    if (!contact.name.trim()) { setContactError("Contact name is required"); return }
    setSavingContact(true)
    setContactError(null)
    try {
      const prospectPayload = {
        companyName: company.companyName,
        website: company.website ?? null,
        industry: company.industry ?? null,
        headquartersCity: company.city ?? null,
        headquartersState: company.state ?? null,
        aiFitScore: company.fitScore ?? null,
        source: "ai_research",
        initialContact: {
          name: contact.name.trim(),
          title: contact.title.trim() || null,
          email: contact.email.trim() || null,
          phone: contact.phone.trim() || null,
          linkedinUrl: contact.linkedin.trim() || null,
          notes: contact.notes.trim() || null,
        },
        initialInteraction: null,
      }

      let res = await fetch("/api/sales/prospects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...prospectPayload, confirmDuplicate: false }),
      })

      if (res.status === 409) {
        const dup = await res.json() as { existing?: { id: string } }
        const existingId = dup.existing?.id
        if (existingId) {
          // Add contact to the existing prospect via companies API
          const r2 = await fetch(`/api/sales/companies/${existingId}/contacts`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(prospectPayload.initialContact),
          })
          if (r2.ok) {
            const d2 = await r2.json() as { contact: { id: string } }
            pushContact({ id: d2.contact.id, name: contact.name.trim(), email: contact.email.trim(), prospectId: existingId })
            return
          }
          // If contact add failed, still use the existing prospect
          pushContact({ id: "", name: contact.name.trim(), email: contact.email.trim(), prospectId: existingId })
          return
        }
        // No existing.id — force-create
        res = await fetch("/api/sales/prospects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...prospectPayload, confirmDuplicate: true }),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setContactError(data.error ?? "Failed to save contact")
        return
      }
      const data = await res.json() as { prospect: { id: string; contacts?: { id: string }[] } }
      pushContact({
        id: data.prospect.contacts?.[0]?.id ?? "",
        name: contact.name.trim(),
        email: contact.email.trim(),
        prospectId: data.prospect.id,
      })
    } catch {
      setContactError("Network error — please try again")
    } finally {
      setSavingContact(false)
    }
  }

  function pushContact(newContact: SavedContact) {
    setSavedContacts(prev => [...prev, newContact])
    setCreated({ prospectId: newContact.prospectId, contactId: newContact.id || null, contactEmail: newContact.email })
    setOutreachContactId(newContact.id)
    setEmailTo(newContact.email)
    setLastSaved(newContact.name)
    setContact(blankContact())
    setSectionOpen(prev => ({ ...prev, outreach: true, contacts: true }))
  }

  async function handleSendEmail() {
    if (!created) return
    if (!emailTo.trim()) { setEmailError("Recipient email required"); return }
    if (!emailSubject.trim()) { setEmailError("Subject required"); return }
    if (!emailBody.trim()) { setEmailError("Body required"); return }
    setSendingEmail(true)
    setEmailError(null)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId) ?? savedContacts[0]
      const res = await fetch(`/api/sales/prospects/${created.prospectId}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject,
          emailBody,
          contactId: sc?.id || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setEmailError(data.error ?? "Send failed")
        return
      }
      setEmailSent(true)
      setEmailSubject("")
      setEmailBody("")
      setSelectedTemplate("")
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleLogInteraction() {
    if (!created) return
    setSavingLog(true)
    setLogError(null)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId)
      const res = await fetch("/api/sales/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prospectId: created.prospectId,
          contactId: sc?.id || null,
          activityType: logType,
          outcome: logOutcome.trim() || null,
          notes: logNotes.trim() || null,
          durationMinutes: logDuration ? parseInt(logDuration, 10) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setLogError(data.error ?? "Failed to log interaction")
        return
      }
      setLogSaved(true)
      setLogOutcome("")
      setLogDuration("")
      setLogNotes("")
    } finally {
      setSavingLog(false)
    }
  }

  async function handleCreateFollowup() {
    if (!created || !followupTitle.trim()) return
    setSavingFollowup(true)
    setFollowupError(null)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId)
      const res = await fetch("/api/sales/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: followupTitle.trim(),
          taskType: "other",
          priority: followupPriority,
          dueAt: followupDueAt || null,
          notes: followupNotes.trim() || null,
          prospectId: created.prospectId,
          contactId: sc?.id || null,
          // No assignedToId — API assigns to the current session user by default
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setFollowupError(data.error ?? "Failed to create follow-up")
        return
      }
      setFollowupSaved(true)
      setFollowupTitle("")
      setFollowupDueAt("")
      setFollowupNotes("")
      setFollowupPriority("normal")
    } finally {
      setSavingFollowup(false)
    }
  }

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
  const sectionHdrCls = "w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"

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
              {company.estimatedEmployees && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />{company.estimatedEmployees} employees
                </span>
              )}
              {websiteHref && (
                <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
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

            {/* Company research */}
            {company.summary && (
              <p className="text-sm text-gray-300 leading-relaxed">{company.summary}</p>
            )}
            {detailsState === "loading" && (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-gray-800 rounded w-32" />
                <div className="h-3 bg-gray-800 rounded w-full" />
                <div className="h-3 bg-gray-800 rounded w-4/5" />
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
                {details.suggestedOutreachAngle && (
                  <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-lg px-3.5 py-2.5">
                    <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Outreach Angle</p>
                    <p className="text-sm text-indigo-200/80">{details.suggestedOutreachAngle}</p>
                  </div>
                )}
              </>
            )}

            {/* ── Section 1: Contact Information ──────────────────────── */}
            <div className="border border-gray-700/60 rounded-xl overflow-hidden">
              <button onClick={() => toggleSection("contact")} className={sectionHdrCls}>
                <User className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-medium text-white text-sm flex-1">Contact Information</span>
                {savedContacts.length > 0 && (
                  <span className="text-[10px] text-gray-500 mr-1">{savedContacts.length} saved</span>
                )}
                {sectionOpen.contact
                  ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
              </button>
              {sectionOpen.contact && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-800 space-y-3">
                  {lastSaved && (
                    <div className="flex items-center gap-2 text-xs text-green-400 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span><span className="font-medium">{lastSaved}</span> saved. Add another contact below.</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Name <span className="text-red-400">*</span></label>
                    <input type="text" value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))}
                      placeholder="Jane Smith" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Title</label>
                      <input type="text" value={contact.title} onChange={e => setContact(c => ({ ...c, title: e.target.value }))}
                        placeholder="Operations Manager" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-2.5 w-3 h-3 text-gray-600" />
                        <input type="text" value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))}
                          placeholder="(555) 000-0000" className={`${inputCls} pl-8`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 w-3 h-3 text-gray-600" />
                      <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                        placeholder="jane@company.com" className={`${inputCls} pl-8`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">LinkedIn</label>
                    <div className="relative">
                      <Link2 className="absolute left-2.5 top-2.5 w-3 h-3 text-gray-600" />
                      <input type="text" value={contact.linkedin} onChange={e => setContact(c => ({ ...c, linkedin: e.target.value }))}
                        placeholder="linkedin.com/in/janesmith" className={`${inputCls} pl-8`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Notes</label>
                    <textarea value={contact.notes} onChange={e => setContact(c => ({ ...c, notes: e.target.value }))}
                      rows={2} placeholder="Anything worth noting..." className={`${inputCls} resize-none`} />
                  </div>
                  {contactError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{contactError}
                    </p>
                  )}
                  <button
                    onClick={handleSaveContact}
                    disabled={savingContact || !contact.name.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {savingContact
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                      : <><User className="w-4 h-4" /> Save Contact &amp; Add to CRM</>
                    }
                  </button>
                </div>
              )}
            </div>

            {/* ── Section 2: Outreach Activity ──────────────────────────── */}
            <div className={`border rounded-xl overflow-hidden ${created ? "border-gray-700/60" : "border-gray-800/40 opacity-50"}`}>
              <button
                onClick={() => created && toggleSection("outreach")}
                className={sectionHdrCls}
              >
                <Mail className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="font-medium text-white text-sm flex-1">Outreach Activity</span>
                {!created && <span className="text-[10px] text-gray-600 mr-1">save a contact first</span>}
                {created && (sectionOpen.outreach
                  ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />)}
              </button>

              {sectionOpen.outreach && created && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-800 space-y-3">
                  {/* Contact selector (only when multiple saved) */}
                  {savedContacts.length > 1 && (
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Contact</label>
                      <select
                        value={outreachContactId}
                        onChange={e => {
                          setOutreachContactId(e.target.value)
                          const sc = savedContacts.find(c => c.id === e.target.value)
                          if (sc?.email) setEmailTo(sc.email)
                        }}
                        className={inputCls}
                      >
                        {savedContacts.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ""}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Tab switcher */}
                  <div className="flex gap-1 p-1 bg-gray-800/60 rounded-lg">
                    <button
                      onClick={() => setOutreachTab("email")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${outreachTab === "email" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                    >
                      <Send className="w-3 h-3" /> Send Email
                    </button>
                    <button
                      onClick={() => setOutreachTab("log")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${outreachTab === "log" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                    >
                      <Calendar className="w-3 h-3" /> Log Interaction
                    </button>
                    <button
                      onClick={() => setOutreachTab("followup")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${outreachTab === "followup" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                    >
                      <Plus className="w-3 h-3" /> Create Follow-Up
                    </button>
                  </div>

                  {/* Email tab */}
                  {outreachTab === "email" && (
                    <div className="space-y-3">
                      {emailSent && (
                        <div className="flex items-center gap-2 text-xs text-green-400 py-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Email sent.
                        </div>
                      )}
                      {templates.length > 0 && (
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Template</label>
                          <div className="relative">
                            <FileText className="absolute left-2.5 top-2.5 w-3 h-3 text-gray-600" />
                            <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)}
                              className={`${inputCls} pl-8`}>
                              <option value="">— select a template —</option>
                              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">To</label>
                        <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                          placeholder="recipient@company.com" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Subject</label>
                        <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Body</label>
                        <textarea rows={9} value={emailBody} onChange={e => setEmailBody(e.target.value)}
                          className={`${inputCls} resize-none font-mono`} />
                      </div>
                      {emailError && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{emailError}
                        </p>
                      )}
                      <button
                        onClick={handleSendEmail}
                        disabled={sendingEmail || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {sendingEmail
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                          : <><Send className="w-4 h-4" /> Send Email</>}
                      </button>
                    </div>
                  )}

                  {/* Log tab */}
                  {outreachTab === "log" && (
                    <div className="space-y-3">
                      {logSaved && (
                        <div className="flex items-center gap-2 text-xs text-indigo-400 py-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Interaction logged.
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Type</label>
                          <select value={logType} onChange={e => setLogType(e.target.value)} className={inputCls}>
                            <option value="CALL_CONNECTED">Phone Call</option>
                            <option value="CALL_ATTEMPTED">Call Attempted</option>
                            <option value="EMAIL_SENT">Email</option>
                            <option value="LINKEDIN_MESSAGE">LinkedIn Message</option>
                            <option value="MEETING_HELD">In-Person Meeting</option>
                            <option value="NOTE_ADDED">Note</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">
                            <Clock className="inline w-3 h-3 mr-1" />Duration (min)
                          </label>
                          <input type="number" min="1" value={logDuration} onChange={e => setLogDuration(e.target.value)}
                            placeholder="15" className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Outcome</label>
                        <input type="text" value={logOutcome} onChange={e => setLogOutcome(e.target.value)}
                          placeholder="Left voicemail, interested, requested follow-up…" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Notes</label>
                        <textarea rows={3} value={logNotes} onChange={e => setLogNotes(e.target.value)}
                          className={`${inputCls} resize-none`} />
                      </div>
                      {logError && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{logError}
                        </p>
                      )}
                      <button
                        onClick={handleLogInteraction}
                        disabled={savingLog}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {savingLog
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                          : "Log Interaction"}
                      </button>
                    </div>
                  )}

                  {/* Follow-up tab */}
                  {outreachTab === "followup" && (
                    <div className="space-y-3">
                      {followupSaved && (
                        <div className="flex items-center gap-2 text-xs text-green-400 py-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Follow-up task created and added to To-Do.
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Task Title <span className="text-red-400">*</span></label>
                        <input type="text" value={followupTitle} onChange={e => setFollowupTitle(e.target.value)}
                          placeholder="Call Bob next Tuesday…" className={inputCls} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Due Date</label>
                          <input type="datetime-local" value={followupDueAt} onChange={e => setFollowupDueAt(e.target.value)}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Priority</label>
                          <select value={followupPriority} onChange={e => setFollowupPriority(e.target.value)} className={inputCls}>
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Notes</label>
                        <textarea rows={3} value={followupNotes} onChange={e => setFollowupNotes(e.target.value)}
                          placeholder="What to cover, context, reminders…"
                          className={`${inputCls} resize-none`} />
                      </div>
                      <p className="text-[10px] text-gray-600">
                        Company: {company.companyName}
                        {savedContacts.find(c => c.id === outreachContactId)?.name
                          ? ` · Contact: ${savedContacts.find(c => c.id === outreachContactId)!.name}`
                          : ""}
                      </p>
                      {followupError && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{followupError}
                        </p>
                      )}
                      <button
                        onClick={handleCreateFollowup}
                        disabled={savingFollowup || !followupTitle.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {savingFollowup
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                          : <><Plus className="w-4 h-4" /> Save Follow-Up</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Section 3: Saved Contacts ─────────────────────────────── */}
            {savedContacts.length > 0 && (
              <div className="border border-gray-700/60 rounded-xl overflow-hidden">
                <button onClick={() => toggleSection("contacts")} className={sectionHdrCls}>
                  <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-medium text-white text-sm flex-1">
                    Saved Contacts <span className="text-gray-500 font-normal">({savedContacts.length})</span>
                  </span>
                  {sectionOpen.contacts
                    ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
                </button>
                {sectionOpen.contacts && (
                  <div className="px-4 pb-3 pt-2 border-t border-gray-800">
                    {savedContacts.map(c => (
                      <div key={`${c.id}-${c.name}`} className="flex items-center gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{c.name}</p>
                          {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setOutreachContactId(c.id)
                              if (c.email) setEmailTo(c.email)
                              setSectionOpen(prev => ({ ...prev, outreach: true }))
                            }}
                            className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors"
                          >
                            Outreach
                          </button>
                          <Link
                            href={`/sales/prospects/${c.prospectId}`}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5"
                          >
                            CRM <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
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

export default function SalesDiscoverPage() {
  const [country,       setCountry]       = useState("United States")
  const [stateProvince, setStateProvince] = useState("")
  const [industry,      setIndustry]      = useState("")
  const [empMin,        setEmpMin]        = useState("")
  const [empMax,        setEmpMax]        = useState("")
  const [locMin,        setLocMin]        = useState("")
  const [keywords,      setKeywords]      = useState("")
  const [context,       setContext]       = useState("")

  const [searchState, setSearchState] = useState<SearchState>("idle")
  const [companies,   setCompanies]   = useState<DiscoveredCompanyBasic[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected,    setSelected]    = useState<DiscoveredCompanyBasic | null>(null)

  const stateLabel = country === "Canada" ? "Province" : country === "United States" ? "State" : "Region"

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchState("loading")
    setSearchError(null)
    setCompanies([])
    setSelected(null)

    const body: Record<string, unknown> = { country }
    if (stateProvince) body.stateProvince     = stateProvince
    if (industry)      body.industry          = industry
    if (empMin)        body.employeeCountMin   = parseInt(empMin,  10)
    if (empMax)        body.employeeCountMax   = parseInt(empMax,  10)
    if (locMin)        body.locationsMin       = parseInt(locMin,  10)
    if (keywords)      body.keywords           = keywords
    if (context)       body.additionalContext  = context

    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `Search failed (${res.status})`)
      }
      const data = await res.json() as { companies: DiscoveredCompanyBasic[] }
      setCompanies(data.companies ?? [])
      setSearchState("done")
    } catch (err) {
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
        <Link href="/sales/prospects"
          className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-sm font-semibold text-white">Find New Prospects</h1>
          <p className="text-[11px] text-gray-500">Search for companies, then add contacts to reach out</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* ── Left: Search form ─────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
          <form onSubmit={handleSearch} className="p-4 space-y-3">

            <div>
              <label className={labelCls}>Country</label>
              <select value={country} onChange={e => { setCountry(e.target.value); setStateProvince("") }}
                className={inputCls}>
                {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

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
                Claude is finding real companies — this takes ~20 seconds
              </p>
            )}
          </form>
        </div>

        {/* ── Right: Results ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchState === "idle" && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <Search className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium mb-1">Find sales prospects</p>
              <p className="text-sm text-gray-600">
                Choose a country and fill in your criteria. Claude returns real companies — click any card to add a contact and start outreach.
              </p>
            </div>
          )}

          {searchState === "loading" && (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-gray-400 font-medium">Finding prospects…</p>
              <p className="text-sm text-gray-600 mt-1">Using Claude&apos;s knowledge to find real companies</p>
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
                  {companies.some(c => c.crmStatus !== "none") && (
                    <span className="text-[11px] text-gray-500 ml-2 font-normal">
                      · {companies.filter(c => c.crmStatus !== "none").length} flagged in CRM
                    </span>
                  )}
                </p>
                {companies.length > 0 && (
                  <p className="text-[11px] text-gray-500">Click a card to add a contact</p>
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

      {selected && (
        <SlideOver
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
