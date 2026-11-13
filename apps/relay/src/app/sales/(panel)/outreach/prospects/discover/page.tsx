"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Search, Loader2, X, ChevronLeft, ChevronDown, ChevronUp, ExternalLink,
  MapPin, Users, CheckCircle2, AlertTriangle,
  Building2, Star, Mail, Globe, User, Plus, Send,
  Link2, FileText, Calendar, Clock,
  Bookmark, Trash2, PenLine,
  RefreshCw, ChevronRight, Save, CheckCheck, Circle,
  BarChart3,
} from "lucide-react"
import type { DiscoveredCompanyBasic, DiscoveredCompanyDetails } from "@/app/api/super-admin/crm/prospects/discover/route"

// ─── Types ────────────────────────────────────────────────────────────────────

type NavSection  = "search" | "lists"
type SearchState = "idle" | "loading" | "done" | "error"
type DetailsState = "loading" | "ready" | "error"

// Extended type used by saved-list context — fresh-search results use resultId=""
type CompanyWithProgress = DiscoveredCompanyBasic & {
  resultId: string   // "" for fresh search, UUID for saved-list results
  isDone:   boolean
  doneAt:   string | null
}

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
  prospectId:   string
  contactId:    string | null
  contactEmail: string
}

interface SavedContact {
  id:         string
  name:       string
  title:      string
  email:      string
  prospectId: string
}

interface ResearchList {
  id:               string
  name:             string
  description:      string | null
  isShared:         boolean
  ownedByMe:        boolean
  searchCountry:    string | null
  searchState:      string | null
  searchIndustry:   string | null
  searchEmpMin:     number | null
  searchEmpMax:     number | null
  searchKeywords:   string | null
  searchContext:    string | null
  status:           string   // "active" | "completed"
  completedAt:      string | null
  manuallyCompleted: boolean
  createdAt:        string
  _count:           { results: number }
  doneCount:        number
}

interface ResearchResult {
  id:                string
  listId:            string
  companyName:       string
  website:           string | null
  verifiedCity:      string | null
  verifiedState:     string | null
  verifiedCountry:   string | null
  industry:          string | null
  estimatedEmployees: string | null
  summary:           string | null
  fitScore:          number | null
  painPoints:        string[]
  relayFitReasons:   string[]
  outreachAngle:     string | null
  prospectId:        string | null
  isDone:            boolean
  doneAt:            string | null
  researchDate:      string
}

interface ResearchListWithResults extends ResearchList {
  results: ResearchResult[]
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

function resultToProgress(r: ResearchResult): CompanyWithProgress {
  return {
    companyName:        r.companyName,
    website:            r.website ?? "",
    city:               r.verifiedCity ?? "",
    state:              r.verifiedState ?? "",
    country:            r.verifiedCountry ?? "United States",
    industry:           r.industry ?? "",
    estimatedEmployees: r.estimatedEmployees ?? "",
    employeeCountTier:  "unknown",
    qualificationTier:  "potential",
    sourceCitations:    [],
    locationVerified:   false,
    summary:            r.summary ?? "",
    fitScore:           r.fitScore ?? 70,
    crmStatus:          r.prospectId ? "in_crm" : "none",
    crmProspectId:      r.prospectId ?? undefined,
    resultId:           r.id,
    isDone:             r.isDone,
    doneAt:             r.doneAt ?? null,
  }
}

function basicToProgress(c: DiscoveredCompanyBasic): CompanyWithProgress {
  return { ...c, resultId: "", isDone: false, doneAt: null }
}

function buildAutoName(params: {
  industry?: string; stateProvince?: string; country?: string; keywords?: string
}): string {
  const parts: string[] = []
  if (params.stateProvince) parts.push(params.stateProvince)
  if (params.industry)      parts.push(params.industry)
  if (parts.length === 0 && params.country) parts.push(params.country)
  if (params.keywords)      parts.push(params.keywords)
  if (parts.length === 0)   parts.push("Prospect Search")
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return `${parts.join(" · ")} — ${date}`
}

function listStatusLabel(list: ResearchList): string {
  if (list.status === "completed") return "Complete"
  if (list.doneCount === 0)        return "Not Started"
  return "In Progress"
}

function listStatusColor(list: ResearchList): string {
  if (list.status === "completed") return "text-green-400 bg-green-900/20 border-green-800/40"
  if (list.doneCount === 0)        return "text-gray-500 bg-gray-800/60 border-gray-700/60"
  return "text-indigo-400 bg-indigo-900/20 border-indigo-800/40"
}

// ─── Save List Dialog ─────────────────────────────────────────────────────────

function SaveListDialog({ suggestedName, onSave, onCancel, saving }: {
  suggestedName: string
  onSave:        (name: string) => void
  onCancel:      () => void
  saving:        boolean
}) {
  const [name, setName] = useState(suggestedName)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 className="text-white font-semibold text-sm mb-1">Save this list</h3>
          <p className="text-[12px] text-gray-500 mb-4">
            Give this set of research results a name so you can return to it later.
          </p>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) onSave(name.trim()) }}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 mb-4"
            placeholder="List name…"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { if (name.trim()) onSave(name.trim()) }}
              disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save List</>}
            </button>
            <button onClick={onCancel} disabled={saving}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({ company, selected, onClick, onToggleDone, showDoneToggle }: {
  company:        CompanyWithProgress
  selected:       boolean
  onClick:        () => void
  onToggleDone?:  (e: React.MouseEvent) => void
  showDoneToggle?: boolean
}) {
  const badge = fitBadge(company.fitScore)
  const isDone = company.isDone

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border rounded-xl p-4 transition-all cursor-pointer ${
        selected
          ? "border-indigo-500 ring-1 ring-indigo-500/30"
          : isDone
            ? "border-gray-800/50 opacity-60 hover:opacity-80 hover:border-gray-700"
            : "border-gray-800 hover:border-gray-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-semibold text-[14px] leading-snug ${isDone ? "text-gray-400" : "text-white"}`}>
              {company.companyName}
            </h3>
            {isDone && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50 flex-shrink-0">
                <CheckCheck className="w-2 h-2" /> Done
              </span>
            )}
            {!isDone && company.crmStatus === "contacted" && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/30 text-orange-400 border border-orange-800/50 flex-shrink-0">
                <CheckCircle2 className="w-2 h-2" />
                Contacted {company.lastContactAt ? formatDate(company.lastContactAt) : ""}
              </span>
            )}
            {!isDone && company.crmStatus === "in_crm" && (
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
              <a
                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-indigo-400/80 hover:text-indigo-300 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-2.5 h-2.5" />{cleanUrl(company.website)}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-lg border ${badge.bg} ${badge.border}`}>
            <span className={`text-lg font-bold leading-none tabular-nums ${badge.text}`}>{company.fitScore}</span>
            <span className="text-[8px] uppercase tracking-widest text-gray-500 mt-0.5">fit</span>
          </div>
          {showDoneToggle && onToggleDone && (
            <button
              onClick={onToggleDone}
              title={isDone ? "Mark as To Do" : "Mark as Done"}
              className={`flex items-center gap-0.5 text-[10px] rounded-md px-1.5 py-0.5 transition-colors ${
                isDone
                  ? "text-green-400/80 hover:text-gray-400 bg-green-900/20 border border-green-800/30"
                  : "text-gray-600 hover:text-gray-300 bg-gray-800 border border-gray-700"
              }`}
            >
              {isDone
                ? <><CheckCheck className="w-2.5 h-2.5" /> Done</>
                : <><Circle className="w-2.5 h-2.5" /> Mark Done</>
              }
            </button>
          )}
        </div>
      </div>
      {company.industry && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/60 mb-2">
          <Building2 className="w-2.5 h-2.5" />{company.industry}
        </span>
      )}
      {company.summary && (
        <p className={`text-[12px] leading-relaxed line-clamp-2 ${isDone ? "text-gray-500" : "text-gray-400"}`}>
          {company.summary}
        </p>
      )}
    </button>
  )
}

// ─── Slide-over ───────────────────────────────────────────────────────────────

function SlideOver({ company, onClose, allCompanies, selectedIndex, onNavigate, onProspectCreated, onOutreachLogged }: {
  company:            CompanyWithProgress
  onClose:            () => void
  allCompanies?:      CompanyWithProgress[]
  selectedIndex?:     number
  onNavigate?:        (newIndex: number) => void
  onProspectCreated?: (prospectId: string) => void
  onOutreachLogged?:  (resultId: string) => void
}) {
  const badge = fitBadge(company.fitScore)
  const websiteHref = company.website
    ? (company.website.startsWith("http") ? company.website : `https://${company.website}`)
    : null

  const hasPrev = allCompanies && selectedIndex !== undefined && selectedIndex > 0
  const hasNext = allCompanies && selectedIndex !== undefined && selectedIndex < allCompanies.length - 1
  const navLabel = allCompanies && selectedIndex !== undefined
    ? `${selectedIndex + 1} of ${allCompanies.length}`
    : null

  function checkUnsaved(c: ContactDraft, subject: string, body: string, ftitle: string): boolean {
    return !!(c.name || c.email || c.title || subject || body || ftitle)
  }

  const [detailsState, setDetailsState] = useState<DetailsState>("loading")
  const [details,      setDetails]      = useState<DiscoveredCompanyDetails | null>(null)
  const [detailsErr,   setDetailsErr]   = useState<string | null>(null)

  const [sectionOpen, setSectionOpen] = useState({ contact: true, outreach: false, contacts: false })
  function toggleSection(s: "contact" | "outreach" | "contacts") {
    setSectionOpen(prev => ({ ...prev, [s]: !prev[s] }))
  }

  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([])
  const [created, setCreated]             = useState<ProspectCreated | null>(null)

  const blankContact = (): ContactDraft => ({ name: "", title: "", email: "", phone: "", linkedin: "", notes: "" })
  const [contact, setContact]             = useState<ContactDraft>(blankContact())
  const [savingContact, setSavingContact] = useState(false)
  const [contactError, setContactError]   = useState<string | null>(null)
  const [lastSaved, setLastSaved]         = useState<string | null>(null)

  type OutreachTab = "email" | "log" | "followup"
  const [outreachTab, setOutreachTab]           = useState<OutreachTab>("email")
  const [outreachContactId, setOutreachContactId] = useState<string>("")

  const [followupTitle, setFollowupTitle]       = useState("")
  const [followupType, setFollowupType]         = useState("other")
  const [followupDueAt, setFollowupDueAt]       = useState("")
  const [followupNotes, setFollowupNotes]       = useState("")
  const [followupPriority, setFollowupPriority] = useState("normal")
  const [savingFollowup, setSavingFollowup]     = useState(false)
  const [followupError, setFollowupError]       = useState<string | null>(null)
  const [followupSaved, setFollowupSaved]       = useState(false)

  const [templates, setTemplates]               = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")

  const [emailTo, setEmailTo]           = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody]       = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError]     = useState<string | null>(null)
  const [emailSent, setEmailSent]       = useState(false)
  const [insertingLink, setInsertingLink] = useState(false)
  const emailBodyRef = useRef<HTMLTextAreaElement>(null)

  const [logType, setLogType]             = useState("CALL_CONNECTED")
  const [logCustomType, setLogCustomType] = useState("")
  const [logOutcome, setLogOutcome]       = useState("")
  const [logDuration, setLogDuration]     = useState("")
  const [logNotes, setLogNotes]           = useState("")
  const [savingLog, setSavingLog]         = useState(false)
  const [logError, setLogError]           = useState<string | null>(null)
  const [logSaved, setLogSaved]           = useState(false)

  // Qualifying outreach types that mark a company Done
  const QUALIFYING = new Set(["EMAIL_SENT", "CALL_CONNECTED", "CALL_VOICEMAIL", "CALL_NO_ANSWER", "MEETING", "MEETING_HELD", "LINKEDIN", "LINKEDIN_MESSAGE"])

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
          const r2 = await fetch(`/api/sales/companies/${existingId}/contacts`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(prospectPayload.initialContact),
          })
          if (r2.ok) {
            const d2 = await r2.json() as { contact: { id: string } }
            pushContact({ id: d2.contact.id, name: contact.name.trim(), title: contact.title.trim(), email: contact.email.trim(), prospectId: existingId })
            return
          }
          pushContact({ id: "", name: contact.name.trim(), title: contact.title.trim(), email: contact.email.trim(), prospectId: existingId })
          return
        }
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
        title: contact.title.trim(),
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
    if (newContact.email) setEmailTo(newContact.email)
    setLastSaved(newContact.name)
    setContact(blankContact())
    setSectionOpen(prev => ({ ...prev, outreach: true, contacts: true }))
    onProspectCreated?.(newContact.prospectId)
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
      // Outreach confirmed — notify parent to update progress
      if (company.resultId) onOutreachLogged?.(company.resultId)
    } finally {
      setSendingEmail(false)
    }
  }

  async function insertDemoLink() {
    if (!created) return
    setInsertingLink(true)
    try {
      const sc = savedContacts.find(c => c.id === outreachContactId) ?? savedContacts[0]
      const res = await fetch("/api/sales/demo-link/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: created.prospectId, contactId: sc?.id ?? null }),
      })
      if (!res.ok) return
      const { url } = await res.json() as { url: string }
      const ta = emailBodyRef.current
      if (ta) {
        const start = ta.selectionStart ?? emailBody.length
        const end   = ta.selectionEnd   ?? emailBody.length
        const next  = emailBody.slice(0, start) + url + emailBody.slice(end)
        setEmailBody(next)
        setTimeout(() => {
          ta.selectionStart = start + url.length
          ta.selectionEnd   = start + url.length
          ta.focus()
        }, 0)
      } else {
        setEmailBody(b => b ? `${b}\n\n${url}` : url)
      }
    } finally {
      setInsertingLink(false)
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
          subject: logType === "OTHER" && logCustomType.trim() ? logCustomType.trim() : null,
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
      setLogCustomType("")
      // Notify parent if this is a qualifying outreach type
      if (company.resultId && QUALIFYING.has(logType)) onOutreachLogged?.(company.resultId)
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
          taskType: followupType,
          priority: followupPriority,
          dueAt: followupDueAt || null,
          notes: followupNotes.trim() || null,
          prospectId: created.prospectId,
          contactId: sc?.id || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setFollowupError(data.error ?? "Failed to create follow-up")
        return
      }
      setFollowupSaved(true)
      setFollowupTitle("")
      setFollowupType("other")
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

        {/* ── Navigation bar (prev/next) ─────────────────────────────────── */}
        {navLabel && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-800/60 flex-shrink-0 bg-gray-900/50">
            <button
              onClick={() => {
                if (!hasPrev) return
                if (checkUnsaved(contact, emailSubject, emailBody, followupTitle) &&
                    !window.confirm("You have unsaved form data. Navigate to the previous company?")) return
                onNavigate!(selectedIndex! - 1)
              }}
              disabled={!hasPrev}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-md hover:bg-gray-800"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="text-[11px] text-gray-500">{navLabel}</span>
            <button
              onClick={() => {
                if (!hasNext) return
                if (checkUnsaved(contact, emailSubject, emailBody, followupTitle) &&
                    !window.confirm("You have unsaved form data. Navigate to the next company?")) return
                onNavigate!(selectedIndex! + 1)
              }}
              disabled={!hasNext}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-md hover:bg-gray-800"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-semibold text-base leading-snug">{company.companyName}</h2>
              {company.isDone && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50">
                  <CheckCheck className="w-2 h-2" /> Done
                </span>
              )}
              {!company.isDone && company.crmStatus === "contacted" && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-900/30 text-orange-400 border border-orange-800/50">
                  <CheckCircle2 className="w-2 h-2" />
                  Contacted {company.lastContactAt ? formatDate(company.lastContactAt) : ""}
                </span>
              )}
              {!company.isDone && company.crmStatus === "in_crm" && (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-800/50">
                  <Building2 className="w-2 h-2" />
                  In CRM
                  {company.crmProspectId && (
                    <Link href={`/sales/prospects/${company.crmProspectId}`} onClick={e => e.stopPropagation()}
                      className="ml-0.5 opacity-70 hover:opacity-100">
                      <ExternalLink className="w-2 h-2" />
                    </Link>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px] text-gray-400">
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
              {websiteHref && (
                <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-indigo-400/80 hover:text-indigo-300 transition-colors">
                  <Globe className="w-2.5 h-2.5" />{cleanUrl(company.website)}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg border ${badge.bg} ${badge.border}`}>
              <span className={`text-base font-bold leading-none tabular-nums ${badge.text}`}>{company.fitScore}</span>
              <span className="text-[8px] uppercase tracking-widest text-gray-500 mt-0.5">fit</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Research summary */}
          <div className="px-5 py-4 border-b border-gray-800/60">
            {detailsState === "loading" && (
              <div className="flex items-center gap-2 text-[12px] text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading research…
              </div>
            )}
            {detailsState === "error" && (
              <p className="text-[12px] text-red-400">{detailsErr}</p>
            )}
            {detailsState === "ready" && details && (
              <div className="space-y-3">
                {details.summary && (
                  <p className="text-[12px] text-gray-300 leading-relaxed">{details.summary}</p>
                )}
                {details.industry && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/60">
                    <Building2 className="w-2.5 h-2.5" />{details.industry}
                  </span>
                )}
                {details.painPoints?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Operational Pain Points</p>
                    <ul className="space-y-1">
                      {details.painPoints.map((p, i) => (
                        <li key={i} className="text-[12px] text-gray-400 flex gap-1.5">
                          <span className="text-orange-500 mt-0.5">·</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {details.suggestedOutreachAngle && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Suggested Angle</p>
                    <p className="text-[12px] text-indigo-300 italic leading-relaxed">{details.suggestedOutreachAngle}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="border-b border-gray-800/60">
            <button className={sectionHdrCls} onClick={() => toggleSection("contact")}>
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm font-medium text-gray-200 flex-1">Save a Contact</span>
              {sectionOpen.contact ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {sectionOpen.contact && (
              <div className="px-4 pb-4 space-y-3">
                {lastSaved && (
                  <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span><span className="font-medium">{lastSaved}</span> saved. Add another contact below.</span>
                  </div>
                )}
                <input type="text" placeholder="Contact name *" value={contact.name}
                  onChange={e => setContact(c => ({ ...c, name: e.target.value }))} className={inputCls} />
                <input type="text" placeholder="Title / role" value={contact.title}
                  onChange={e => setContact(c => ({ ...c, title: e.target.value }))} className={inputCls} />
                <input type="email" placeholder="Email" value={contact.email}
                  onChange={e => setContact(c => ({ ...c, email: e.target.value }))} className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="tel" placeholder="Phone" value={contact.phone}
                    onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} className={inputCls} />
                  <input type="url" placeholder="LinkedIn URL" value={contact.linkedin}
                    onChange={e => setContact(c => ({ ...c, linkedin: e.target.value }))} className={inputCls} />
                </div>
                <textarea rows={2} placeholder="Notes…" value={contact.notes}
                  onChange={e => setContact(c => ({ ...c, notes: e.target.value }))}
                  className={`${inputCls} resize-none`} />
                {contactError && <p className="text-[12px] text-red-400">{contactError}</p>}
                <button
                  onClick={() => void handleSaveContact()}
                  disabled={savingContact || !contact.name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingContact
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : <><Plus className="w-3.5 h-3.5" /> Save Contact & Add to CRM</>}
                </button>
              </div>
            )}
          </div>

          {/* Outreach */}
          <div className="border-b border-gray-800/60">
            <button className={sectionHdrCls} onClick={() => toggleSection("outreach")}>
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm font-medium text-gray-200 flex-1">Outreach</span>
              {!created && <span className="text-[10px] text-gray-600 mr-1">Save a contact first</span>}
              {sectionOpen.outreach ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {sectionOpen.outreach && (
              <div className="px-4 pb-4">
                {!created ? (
                  <p className="text-[12px] text-gray-500 py-2">Save a contact above to unlock outreach.</p>
                ) : (
                  <>
                    {savedContacts.length > 1 && (
                      <div className="mb-3">
                        <label className="block text-[11px] text-gray-500 mb-1">Sending to</label>
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
                            <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5 mb-3">
                      {(["email", "log", "followup"] as OutreachTab[]).map(tab => (
                        <button key={tab} onClick={() => setOutreachTab(tab)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${outreachTab === tab ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>
                          {tab === "email"    && <><Mail className="w-3 h-3" /> Email</>}
                          {tab === "log"      && <><FileText className="w-3 h-3" /> Log</>}
                          {tab === "followup" && <><Clock className="w-3 h-3" /> Follow-up</>}
                        </button>
                      ))}
                    </div>

                    {outreachTab === "email" && (
                      <div className="space-y-2">
                        {emailSent && (
                          <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Email sent!
                          </div>
                        )}
                        {templates.length > 0 && (
                          <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)} className={inputCls}>
                            <option value="">Use a template…</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                        <input type="email" placeholder="To" value={emailTo}
                          onChange={e => setEmailTo(e.target.value)} className={inputCls} />
                        <input type="text" placeholder="Subject" value={emailSubject}
                          onChange={e => setEmailSubject(e.target.value)} className={inputCls} />
                        <textarea ref={emailBodyRef} rows={6} placeholder="Message…" value={emailBody}
                          onChange={e => setEmailBody(e.target.value)} className={`${inputCls} resize-none`} />
                        <button onClick={() => void insertDemoLink()} disabled={insertingLink}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                          <Link2 className="w-3 h-3" />
                          {insertingLink ? "Inserting…" : "Insert demo link"}
                        </button>
                        {emailError && <p className="text-[12px] text-red-400">{emailError}</p>}
                        <button
                          onClick={() => void handleSendEmail()}
                          disabled={sendingEmail || !emailTo || !emailSubject || !emailBody}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {sendingEmail ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send Email</>}
                        </button>
                      </div>
                    )}

                    {outreachTab === "log" && (
                      <div className="space-y-2">
                        {logSaved && (
                          <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Interaction logged
                          </div>
                        )}
                        <select value={logType} onChange={e => setLogType(e.target.value)} className={inputCls}>
                          <option value="CALL_CONNECTED">Call — Connected</option>
                          <option value="CALL_VOICEMAIL">Call — Voicemail</option>
                          <option value="CALL_NO_ANSWER">Call — No Answer</option>
                          <option value="EMAIL_SENT">Email Sent</option>
                          <option value="EMAIL_REPLIED">Email Replied</option>
                          <option value="MEETING">Meeting</option>
                          <option value="LINKEDIN">LinkedIn Message</option>
                          <option value="OTHER">Other</option>
                        </select>
                        {logType === "OTHER" && (
                          <input type="text" placeholder="Activity type" value={logCustomType}
                            onChange={e => setLogCustomType(e.target.value)} className={inputCls} />
                        )}
                        <input type="text" placeholder="Outcome (optional)" value={logOutcome}
                          onChange={e => setLogOutcome(e.target.value)} className={inputCls} />
                        <input type="number" placeholder="Duration (minutes)" value={logDuration}
                          onChange={e => setLogDuration(e.target.value)} className={inputCls} />
                        <textarea rows={2} placeholder="Notes…" value={logNotes}
                          onChange={e => setLogNotes(e.target.value)} className={`${inputCls} resize-none`} />
                        {logError && <p className="text-[12px] text-red-400">{logError}</p>}
                        <button
                          onClick={() => void handleLogInteraction()}
                          disabled={savingLog}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {savingLog ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><FileText className="w-3.5 h-3.5" /> Log Interaction</>}
                        </button>
                      </div>
                    )}

                    {outreachTab === "followup" && (
                      <div className="space-y-2">
                        {followupSaved && (
                          <div className="flex items-center gap-2 text-[12px] text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Follow-up created
                          </div>
                        )}
                        <input type="text" placeholder="Follow-up title *" value={followupTitle}
                          onChange={e => setFollowupTitle(e.target.value)} className={inputCls} />
                        <div className="grid grid-cols-2 gap-2">
                          <select value={followupType} onChange={e => setFollowupType(e.target.value)} className={inputCls}>
                            <option value="call">Call</option>
                            <option value="email">Email</option>
                            <option value="meeting">Meeting</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="other">Other</option>
                          </select>
                          <select value={followupPriority} onChange={e => setFollowupPriority(e.target.value)} className={inputCls}>
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <input type="datetime-local" value={followupDueAt}
                          onChange={e => setFollowupDueAt(e.target.value)} className={inputCls} />
                        <textarea rows={2} placeholder="Notes…" value={followupNotes}
                          onChange={e => setFollowupNotes(e.target.value)} className={`${inputCls} resize-none`} />
                        {followupError && <p className="text-[12px] text-red-400">{followupError}</p>}
                        <button
                          onClick={() => void handleCreateFollowup()}
                          disabled={savingFollowup || !followupTitle.trim()}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {savingFollowup ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Calendar className="w-3.5 h-3.5" /> Create Follow-up</>}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Saved Contacts */}
          {savedContacts.length > 0 && (
            <div>
              <button className={sectionHdrCls} onClick={() => toggleSection("contacts")}>
                <Star className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-medium text-gray-200 flex-1">
                  Saved Contacts <span className="text-gray-500 font-normal">({savedContacts.length})</span>
                </span>
                {sectionOpen.contacts ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {sectionOpen.contacts && (
                <div className="px-4 pb-4 space-y-1">
                  {savedContacts.map(c => {
                    const isActive = c.id === outreachContactId
                    return (
                      <button key={c.id || c.email}
                        onClick={() => {
                          setOutreachContactId(c.id)
                          if (c.email) setEmailTo(c.email)
                          setSectionOpen(prev => ({ ...prev, outreach: true }))
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${isActive ? "bg-indigo-900/30 border border-indigo-800/40" : "hover:bg-gray-800/40"}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isActive ? "text-indigo-300" : "text-white"}`}>{c.name}</p>
                          {c.title && <p className="text-[11px] text-gray-500">{c.title}</p>}
                          {c.email && <p className="text-[11px] text-gray-500">{c.email}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isActive && (
                            <span className="text-[10px] text-indigo-400 font-medium px-1.5 py-0.5 rounded-full bg-indigo-900/30 border border-indigo-800/40">Active</span>
                          )}
                          <Link href={`/sales/prospects/${c.prospectId}`} onClick={e => e.stopPropagation()}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5">
                            CRM <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Saved Lists Section ──────────────────────────────────────────────────────

function SavedListsSection({ onSelectCompany, externalDoneIds }: {
  onSelectCompany: (all: CompanyWithProgress[], index: number, listId: string) => void
  externalDoneIds: Set<string>
}) {
  const [lists,       setLists]       = useState<ResearchList[] | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [openList,    setOpenList]    = useState<ResearchListWithResults | null>(null)
  const [loadingList, setLoadingList] = useState<string | null>(null)
  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameVal,   setRenameVal]   = useState("")
  const [savingRename, setSavingRename] = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [togglingDone, setTogglingDone] = useState<string | null>(null)
  const [togglingList, setTogglingList] = useState<string | null>(null)
  // CRM status overrides set during this session
  const [localProspectIds, setLocalProspectIds] = useState<Record<string, string>>({})

  function loadLists() {
    setLoading(true)
    fetch("/api/super-admin/crm/prospects/discover/lists")
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setLists(d as ResearchList[]); setLoading(false) })
      .catch(() => { setError("Failed to load lists"); setLoading(false) })
  }
  useEffect(loadLists, [])

  async function openListDetail(list: ResearchList) {
    setLoadingList(list.id)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${list.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json() as ResearchListWithResults
      setOpenList(data)
    } catch {
      setError("Failed to load list details")
    } finally {
      setLoadingList(null)
    }
  }

  async function handleRename(id: string) {
    if (!renameVal.trim()) return
    setSavingRename(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: renameVal.trim() }),
      })
      if (!res.ok) return
      const updated = await res.json() as ResearchList
      setLists(prev => prev?.map(l => l.id === id ? { ...l, name: updated.name } : l) ?? null)
      if (openList?.id === id) setOpenList(prev => prev ? { ...prev, name: updated.name } : null)
    } finally {
      setSavingRename(false)
      setRenamingId(null)
      setRenameVal("")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this list? Results that have been added to CRM will not be affected.")) return
    setDeletingId(id)
    try {
      await fetch(`/api/super-admin/crm/prospects/discover/lists/${id}`, { method: "DELETE" })
      setLists(prev => prev?.filter(l => l.id !== id) ?? null)
      if (openList?.id === id) setOpenList(null)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleListStatus(list: ResearchList) {
    const newStatus = list.status === "completed" ? "active" : "completed"
    setTogglingList(list.id)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/lists/${list.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) return
      const updated = await res.json() as ResearchList
      setLists(prev => prev?.map(l => l.id === list.id ? { ...l, ...updated } : l) ?? null)
      if (openList?.id === list.id) {
        setOpenList(prev => prev ? { ...prev, status: updated.status, completedAt: updated.completedAt, manuallyCompleted: updated.manuallyCompleted } : null)
      }
    } finally {
      setTogglingList(null)
    }
  }

  async function handleToggleDone(result: ResearchResult, currentIsDone: boolean) {
    if (!openList) return
    const newIsDone = !currentIsDone
    setTogglingDone(result.id)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/discover/results/${result.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isDone: newIsDone }),
      })
      if (!res.ok) return
      const updated = await res.json() as { id: string; isDone: boolean; listAutoCompleted?: boolean }

      // Update the open list's results in-place
      setOpenList(prev => {
        if (!prev) return null
        return {
          ...prev,
          status: updated.listAutoCompleted ? "completed" : (
            !newIsDone && prev.status === "completed" && !prev.manuallyCompleted ? "active" : prev.status
          ),
          results: prev.results.map(r => r.id === result.id ? { ...r, isDone: updated.isDone, doneAt: updated.isDone ? new Date().toISOString() : null } : r),
        }
      })

      // Update the list index counts
      setLists(prev => prev?.map(l => {
        if (l.id !== openList.id) return l
        const delta = newIsDone ? 1 : -1
        const newDoneCount = Math.max(0, l.doneCount + delta)
        return {
          ...l,
          doneCount: newDoneCount,
          status: updated.listAutoCompleted ? "completed" :
            (!newIsDone && l.status === "completed" && !l.manuallyCompleted ? "active" : l.status),
        }
      }) ?? null)
    } finally {
      setTogglingDone(null)
    }
  }

  // Build CompanyWithProgress array for a given list, applying external overrides
  function getCompanies(list: ResearchListWithResults): CompanyWithProgress[] {
    return list.results.map(r => {
      const localPid = localProspectIds[r.companyName]
      const isDone = externalDoneIds.has(r.id) || r.isDone
      return {
        ...resultToProgress(r),
        crmStatus:    localPid ? "in_crm" as const : (r.prospectId ? "in_crm" as const : "none" as const),
        crmProspectId: localPid ?? r.prospectId ?? undefined,
        isDone,
      }
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    </div>
  )
  if (error) return <div className="p-6 text-center text-red-400 text-sm">{error}</div>

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (openList) {
    const companies = getCompanies(openList)
    const toDo      = companies.filter(c => !c.isDone)
    const done      = companies.filter(c =>  c.isDone)
    const allDone   = companies.length > 0 && toDo.length === 0
    const isComplete = openList.status === "completed" || allDone

    return (
      <div className="flex flex-col h-full">
        {/* List header */}
        <div className="border-b border-gray-800 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setOpenList(null)}
              className="text-gray-400 hover:text-gray-200 transition-colors p-0.5 flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {renamingId === openList.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input autoFocus value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void handleRename(openList.id); if (e.key === "Escape") { setRenamingId(null); setRenameVal("") } }}
                  className="flex-1 bg-gray-800 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
                <button onClick={() => void handleRename(openList.id)} disabled={savingRename}
                  className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md">
                  {savingRename ? "…" : "Save"}
                </button>
                <button onClick={() => { setRenamingId(null); setRenameVal("") }} className="text-gray-400 hover:text-gray-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-white truncate">{openList.name}</h2>
                <button onClick={() => { setRenamingId(openList.id); setRenameVal(openList.name) }}
                  className="text-gray-500 hover:text-gray-300 flex-shrink-0" title="Rename list">
                  <PenLine className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* Complete / Reopen */}
            <button
              onClick={() => void handleToggleListStatus(openList)}
              disabled={togglingList === openList.id}
              className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${
                isComplete
                  ? "text-green-400 border-green-800/40 bg-green-900/20 hover:bg-green-900/30"
                  : "text-gray-500 border-gray-700 bg-gray-800 hover:text-gray-300"
              }`}
            >
              {togglingList === openList.id
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : isComplete
                  ? <><RefreshCw className="w-2.5 h-2.5" /> Reopen</>
                  : <><CheckCheck className="w-2.5 h-2.5" /> Complete</>
              }
            </button>
          </div>

          {/* Progress bar */}
          <div className="ml-6">
            <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
              <span className="text-gray-400 font-medium">{done.length} of {companies.length} done</span>
              {openList.searchState && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{openList.searchState}</span>}
              {openList.searchIndustry && <span>{openList.searchIndustry}</span>}
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-indigo-500"}`}
                style={{ width: companies.length > 0 ? `${(done.length / companies.length) * 100}%` : "0%" }}
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Click any company to open the full prospecting workflow · use card button to mark done</p>
          </div>
        </div>

        {/* Company cards */}
        <div className="flex-1 overflow-y-auto p-4">
          {companies.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No companies in this list yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* To Do section */}
              {toDo.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Circle className="w-2.5 h-2.5" /> To Do ({toDo.length})
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {toDo.map(c => (
                      <CompanyCard
                        key={c.companyName}
                        company={c}
                        selected={false}
                        showDoneToggle
                        onToggleDone={e => {
                          e.stopPropagation()
                          const result = openList.results.find(r => r.id === c.resultId)
                          if (result) void handleToggleDone(result, c.isDone)
                        }}
                        onClick={() => onSelectCompany(companies, companies.indexOf(c), openList.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Already Done section */}
              {done.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-green-600/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCheck className="w-2.5 h-2.5" /> Already Done ({done.length})
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {done.map(c => (
                      <CompanyCard
                        key={c.companyName}
                        company={c}
                        selected={false}
                        showDoneToggle
                        onToggleDone={e => {
                          e.stopPropagation()
                          const result = openList.results.find(r => r.id === c.resultId)
                          if (result) void handleToggleDone(result, c.isDone)
                        }}
                        onClick={() => onSelectCompany(companies, companies.indexOf(c), openList.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── List index ──────────────────────────────────────────────────────────────
  const activeLists    = lists?.filter(l => l.status !== "completed") ?? []
  const completedLists = lists?.filter(l => l.status === "completed") ?? []

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {(!lists || lists.length === 0) ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 py-16">
          <Bookmark className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium mb-1">No saved lists yet</p>
          <p className="text-sm text-gray-600">
            Run a search and click <strong className="text-gray-400">Save List</strong> to save your results for later.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active lists */}
          {activeLists.length > 0 && (
            <div>
              {completedLists.length > 0 && (
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Active</p>
              )}
              <div className="space-y-2">
                {activeLists.map(list => <ListCard key={list.id} list={list} onOpen={openListDetail} onRename={(id, val) => { setRenamingId(id); setRenameVal(val) }} renamingId={renamingId} renameVal={renameVal} savingRename={savingRename} onRenameConfirm={handleRename} onRenameCancel={() => { setRenamingId(null); setRenameVal("") }} onRenameChange={setRenameVal} onDelete={handleDelete} deletingId={deletingId} loadingList={loadingList} onToggleStatus={handleToggleListStatus} togglingList={togglingList} />)}
              </div>
            </div>
          )}

          {/* Completed lists */}
          {completedLists.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCheck className="w-2.5 h-2.5" /> Completed Lists ({completedLists.length})
              </p>
              <div className="space-y-2 opacity-70">
                {completedLists.map(list => <ListCard key={list.id} list={list} onOpen={openListDetail} onRename={(id, val) => { setRenamingId(id); setRenameVal(val) }} renamingId={renamingId} renameVal={renameVal} savingRename={savingRename} onRenameConfirm={handleRename} onRenameCancel={() => { setRenamingId(null); setRenameVal("") }} onRenameChange={setRenameVal} onDelete={handleDelete} deletingId={deletingId} loadingList={loadingList} onToggleStatus={handleToggleListStatus} togglingList={togglingList} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── List Card (extracted for reuse in active + completed sections) ───────────

function ListCard({ list, onOpen, onRename, renamingId, renameVal, savingRename, onRenameConfirm, onRenameCancel, onRenameChange, onDelete, deletingId, loadingList, onToggleStatus, togglingList }: {
  list:              ResearchList
  onOpen:            (list: ResearchList) => void
  onRename:          (id: string, val: string) => void
  renamingId:        string | null
  renameVal:         string
  savingRename:      boolean
  onRenameConfirm:   (id: string) => void
  onRenameCancel:    () => void
  onRenameChange:    (v: string) => void
  onDelete:          (id: string) => void
  deletingId:        string | null
  loadingList:       string | null
  onToggleStatus:    (list: ResearchList) => void
  togglingList:      string | null
}) {
  const total     = list._count.results
  const done      = list.doneCount
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0
  const statusLbl = listStatusLabel(list)
  const statusCls = listStatusColor(list)
  const isComplete = list.status === "completed"

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 hover:border-gray-700 transition-colors ${isComplete ? "border-gray-800/50" : "border-gray-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {renamingId === list.id ? (
            <div className="flex items-center gap-2 mb-1">
              <input autoFocus value={renameVal} onChange={e => onRenameChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void onRenameConfirm(list.id); if (e.key === "Escape") onRenameCancel() }}
                className="flex-1 bg-gray-800 border border-indigo-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none" />
              <button onClick={() => void onRenameConfirm(list.id)} disabled={savingRename}
                className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md">
                {savingRename ? "…" : "Save"}
              </button>
              <button onClick={onRenameCancel} className="text-gray-400 hover:text-gray-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => onOpen(list)}
                className="flex items-center gap-1.5 group flex-1 min-w-0 text-left">
                <h3 className={`text-sm font-semibold truncate group-hover:text-indigo-300 transition-colors ${isComplete ? "text-gray-400" : "text-white"}`}>
                  {list.name}
                </h3>
                {loadingList === list.id && <Loader2 className="w-3 h-3 animate-spin text-indigo-400 flex-shrink-0" />}
              </button>
              <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${statusCls}`}>
                {statusLbl}
              </span>
            </div>
          )}

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
              <span>{done} of {total} done</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isComplete ? "bg-green-500" : pct > 0 ? "bg-indigo-500" : "bg-gray-700"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
            <span className="text-gray-400 font-medium">{total} companies</span>
            {list.searchState && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{list.searchState}</span>}
            {list.searchIndustry && <span>{list.searchIndustry}</span>}
            <span>{formatDate(list.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button onClick={() => onRename(list.id, list.name)}
              className="text-gray-600 hover:text-gray-400 transition-colors p-1" title="Rename">
              <PenLine className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => void onDelete(list.id)} disabled={deletingId === list.id}
              className="text-gray-600 hover:text-red-400 transition-colors p-1">
              {deletingId === list.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={() => onToggleStatus(list)}
            disabled={togglingList === list.id}
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
              isComplete
                ? "text-green-400/70 border-green-800/30 hover:text-green-300"
                : "text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
          >
            {togglingList === list.id
              ? <Loader2 className="w-2 h-2 animate-spin" />
              : isComplete
                ? <><RefreshCw className="w-2 h-2" /> Reopen</>
                : <><CheckCheck className="w-2 h-2" /> Complete</>
            }
          </button>
        </div>
      </div>
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

export default function SalesDiscoverPage() {
  const [section, setSection] = useState<NavSection>("search")

  const [country,       setCountry]       = useState("United States")
  const [stateProvince, setStateProvince] = useState("")
  const [industry,      setIndustry]      = useState("")
  const [empMin,        setEmpMin]        = useState("")
  const [empMax,        setEmpMax]        = useState("")
  const [locMin,        setLocMin]        = useState("")
  const [keywords,      setKeywords]      = useState("")
  const [context,       setContext]       = useState("")

  const [searchState, setSearchState] = useState<SearchState>("idle")
  const [companies,   setCompanies]   = useState<CompanyWithProgress[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [savingList,     setSavingList]     = useState(false)
  const [savedListId,    setSavedListId]    = useState<string | null>(null)
  const [savedListName,  setSavedListName]  = useState<string | null>(null)
  const saveDialogSuggestion = buildAutoName({ industry, stateProvince, country, keywords })

  // Shared company selection — works for both search and saved-list contexts
  const [activeCompanies, setActiveCompanies] = useState<CompanyWithProgress[]>([])
  const [selectedIndex,   setSelectedIndex]   = useState<number | null>(null)
  const [activeListId,    setActiveListId]     = useState<string | null>(null)
  const selected = selectedIndex !== null ? (activeCompanies[selectedIndex] ?? null) : null

  // Tracks result IDs marked done in this session, passed down to SavedListsSection
  // so it can update card rendering without a full re-fetch
  const [externalDoneIds, setExternalDoneIds] = useState<Set<string>>(new Set())

  const stateLabel = country === "Canada" ? "Province" : country === "United States" ? "State" : "Region"

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchState("loading")
    setSearchError(null)
    setCompanies([])
    setSelectedIndex(null)
    setSavedListId(null)
    setSavedListName(null)
    setActiveListId(null)

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
      const found = (data.companies ?? []).map(basicToProgress)
      setCompanies(found)
      setActiveCompanies(found)
      setSearchState("done")
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed")
      setSearchState("error")
    }
  }

  async function handleSaveList(name: string) {
    setSavingList(true)
    try {
      const res = await fetch("/api/super-admin/crm/prospects/discover/lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          searchCountry:  country || null,
          searchState:    stateProvince || null,
          searchIndustry: industry || null,
          searchEmpMin:   empMin ? parseInt(empMin, 10) : null,
          searchEmpMax:   empMax ? parseInt(empMax, 10) : null,
          searchKeywords: keywords || null,
          searchContext:  context || null,
          results:        companies,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? "Save failed")
      }
      const saved = await res.json() as ResearchList
      setSavedListId(saved.id)
      setSavedListName(saved.name)
      setShowSaveDialog(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save list — please try again")
    } finally {
      setSavingList(false)
    }
  }

  // Called by SlideOver when a prospect is created from a research result
  function handleProspectCreated(prospectId: string) {
    if (selectedIndex === null) return
    const resultId = activeCompanies[selectedIndex]?.resultId
    const updated = activeCompanies.map((c, i) =>
      i === selectedIndex ? { ...c, crmStatus: "in_crm" as const, crmProspectId: prospectId } : c
    )
    setActiveCompanies(updated)
    if (section === "search") setCompanies(updated)

    // Persist the link to the DB row if this is a saved-list result
    if (resultId) {
      void fetch(`/api/super-admin/crm/prospects/discover/results/${resultId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospectId }),
      })
    }
  }

  // Called by SlideOver after confirmed outreach — optimistic UI update
  // (server already marked the DB rows done via markOutreachDone)
  function handleOutreachLogged(resultId: string) {
    if (!resultId) return
    setExternalDoneIds(prev => new Set([...prev, resultId]))
    setActiveCompanies(prev => prev.map(c =>
      c.resultId === resultId ? { ...c, isDone: true } : c
    ))
    if (section === "search") {
      setCompanies(prev => prev.map(c =>
        c.resultId === resultId ? { ...c, isDone: true } : c
      ))
    }
  }

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
  const labelCls = "block text-[11px] font-medium text-gray-400 mb-1.5"

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-0 flex items-center gap-0">
        <Link href="/sales/prospects"
          className="text-gray-400 hover:text-gray-200 transition-colors p-3 mr-1 border-r border-gray-800">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        {(["search", "lists"] as NavSection[]).map(tab => (
          <button key={tab}
            onClick={() => { setSection(tab); setSelectedIndex(null) }}
            className={`flex items-center gap-1.5 px-5 py-4 text-[12px] font-medium border-b-2 transition-colors ${
              section === tab
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}>
            {tab === "search" && <><Search className="w-3.5 h-3.5" /> Find Prospects</>}
            {tab === "lists"  && <><Bookmark className="w-3.5 h-3.5" /> Saved Lists</>}
          </button>
        ))}
      </div>

      {/* Find Prospects */}
      {section === "search" && (
        <div className="flex h-[calc(100vh-57px)]">
          {/* Search form */}
          <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
            <form onSubmit={e => void handleSearch(e)} className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Country</label>
                <select value={country} onChange={e => { setCountry(e.target.value); setStateProvince("") }} className={inputCls}>
                  {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{country === "Other" ? "Region / Location" : stateLabel}</label>
                <input type="text"
                  placeholder={country === "Canada" ? "e.g. Ontario, BC" : country === "United States" ? "e.g. Texas, Midwest" : "e.g. Southeast Asia"}
                  value={stateProvince} onChange={e => setStateProvince(e.target.value)} className={inputCls} />
              </div>
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
                  <input type="number" placeholder="Min" value={empMin} onChange={e => setEmpMin(e.target.value)} className={inputCls} />
                  <input type="number" placeholder="Max" value={empMax} onChange={e => setEmpMax(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Min. Locations</label>
                <input type="number" placeholder="e.g. 3" value={locMin} onChange={e => setLocMin(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Keywords</label>
                <input type="text" placeholder="e.g. warehousing, cold storage" value={keywords}
                  onChange={e => setKeywords(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Additional Context</label>
                <textarea rows={3} placeholder="Any other targeting details…" value={context}
                  onChange={e => setContext(e.target.value)} className={`${inputCls} resize-none`} />
              </div>
              <button type="submit" disabled={searchState === "loading"}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                {searchState === "loading"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
                  : <><Search className="w-4 h-4" /> Find Prospects</>}
              </button>
              {searchState === "loading" && (
                <p className="text-[11px] text-gray-500 text-center">Claude is finding real companies — this takes ~20 seconds</p>
              )}
            </form>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {searchState === "idle" && (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <Search className="w-12 h-12 text-gray-700 mb-3" />
                <p className="text-gray-400 font-medium mb-1">Find sales prospects</p>
                <p className="text-sm text-gray-600">Fill in your criteria and click Find Prospects. Click any card to open the full outreach workflow.</p>
                <button onClick={() => setSection("lists")}
                  className="mt-4 flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                  <Bookmark className="w-4 h-4" /> View saved lists
                </button>
              </div>
            )}

            {searchState === "loading" && (
              <div className="h-full flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                <p className="text-gray-400 font-medium">Finding prospects…</p>
                <p className="text-sm text-gray-600 mt-1">Using Claude to find real companies</p>
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
                    {activeCompanies.some(c => c.crmStatus !== "none") && (
                      <span className="text-[11px] text-gray-500 ml-2 font-normal">
                        · {activeCompanies.filter(c => c.crmStatus !== "none").length} in CRM
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {savedListId ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-green-400">
                        <Bookmark className="w-3 h-3" />
                        Saved as <button onClick={() => setSection("lists")} className="font-medium underline underline-offset-2 hover:text-green-300">{savedListName}</button>
                      </span>
                    ) : (
                      <button onClick={() => setShowSaveDialog(true)}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors">
                        <Save className="w-3 h-3" /> Save List
                      </button>
                    )}
                    <p className="text-[11px] text-gray-500">Click a company to start</p>
                  </div>
                </div>

                {companies.length === 0 && (
                  <div className="text-center py-16 text-gray-500">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>No companies found. Try broader criteria.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {activeCompanies.map((c, i) => (
                    <CompanyCard
                      key={c.companyName}
                      company={c}
                      selected={selectedIndex === i}
                      onClick={() => { setActiveCompanies(activeCompanies); setSelectedIndex(i) }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Saved Lists */}
      {section === "lists" && (
        <div className="flex flex-col h-[calc(100vh-57px)]">
          <SavedListsSection
            externalDoneIds={externalDoneIds}
            onSelectCompany={(all, index, listId) => {
              setActiveCompanies(all)
              setActiveListId(listId)
              setSelectedIndex(index)
            }}
          />
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <SaveListDialog
          suggestedName={saveDialogSuggestion}
          onSave={name => void handleSaveList(name)}
          onCancel={() => setShowSaveDialog(false)}
          saving={savingList}
        />
      )}

      {/* Shared SlideOver — same for both fresh search and saved-list contexts */}
      {selected !== null && (
        <SlideOver
          key={selected.companyName}
          company={selected}
          onClose={() => setSelectedIndex(null)}
          allCompanies={activeCompanies}
          selectedIndex={selectedIndex!}
          onNavigate={newIdx => setSelectedIndex(newIdx)}
          onProspectCreated={handleProspectCreated}
          onOutreachLogged={handleOutreachLogged}
        />
      )}
    </div>
  )
}
