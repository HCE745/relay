"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Globe, ExternalLink, Mail, RefreshCw, Loader2, Plus, Trash2,
  Building2, ChevronDown, X, Copy, CheckCircle2, Send, Zap, User,
  MessageSquare, StickyNote, Link2,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

type ProspectCrmStatus =
  | "researched" | "contacted" | "replied" | "demo_scheduled"
  | "trial" | "customer" | "not_interested" | "do_not_contact"

type ProspectSource = "ai_research" | "manual" | "referral" | "inbound" | "imported"

type EmailConfidenceLevel =
  | "verified" | "accepts_mail" | "catch_all" | "risky" | "unknown" | "invalid"

interface ProspectContact {
  id: string
  name: string
  title: string | null
  email: string | null
  emailSource: string | null
  emailConfidence: EmailConfidenceLevel | null
  linkedinUrl: string | null
  notes: string | null
  createdAt: string
}

interface ProspectNote {
  id: string
  noteText: string
  createdBy: string | null
  createdAt: string
}

interface Prospect {
  id: string
  companyName: string
  website: string | null
  industry: string | null
  employeeCountMin: number | null
  employeeCountMax: number | null
  locationsCount: number | null
  headquartersCity: string | null
  headquartersState: string | null
  headquartersCountry: string | null
  linkedinUrl: string | null
  source: ProspectSource
  aiFitScore: number | null
  researchSummary: string | null
  operationalPainPoints: string | null
  relayFitReasons: string | null
  suggestedDemoEmphasis: string | null
  suggestedOutreachAngle: string | null
  decisionMakerTitles: string[]
  confidenceScore: number | null
  currentCrmStatus: ProspectCrmStatus
  assignedToName: string | null
  dateResearched: string | null
  lastOutreachDate: string | null
  lastReplyDate: string | null
  pipelineStage: string | null
  duplicateFlag: boolean
  createdAt: string
  updatedAt: string
  contacts: ProspectContact[]
  notes: ProspectNote[]
}

interface OutreachResult {
  subject: string
  bodyHtml: string
  bodyText: string
  followUpSubjects: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CRM_STATUSES: { value: ProspectCrmStatus; label: string }[] = [
  { value: "researched",     label: "Researched"      },
  { value: "contacted",      label: "Contacted"       },
  { value: "replied",        label: "Replied"         },
  { value: "demo_scheduled", label: "Demo Scheduled"  },
  { value: "trial",          label: "Trial"           },
  { value: "customer",       label: "Customer"        },
  { value: "not_interested", label: "Not Interested"  },
  { value: "do_not_contact", label: "Do Not Contact"  },
]

const STATUS_COLORS: Record<ProspectCrmStatus, string> = {
  researched:      "bg-gray-800 text-gray-300 border-gray-700",
  contacted:       "bg-blue-900/50 text-blue-300 border-blue-800",
  replied:         "bg-indigo-900/50 text-indigo-300 border-indigo-800",
  demo_scheduled:  "bg-purple-900/50 text-purple-300 border-purple-800",
  trial:           "bg-cyan-900/50 text-cyan-300 border-cyan-800",
  customer:        "bg-green-900/50 text-green-300 border-green-800",
  not_interested:  "bg-orange-900/50 text-orange-300 border-orange-800",
  do_not_contact:  "bg-red-900/50 text-red-300 border-red-800",
}

const EMAIL_CONFIDENCE_COLORS: Record<string, string> = {
  verified:      "bg-green-900/50 text-green-300 border-green-700",
  accepts_mail:  "bg-teal-900/50 text-teal-300 border-teal-700",
  catch_all:     "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  risky:         "bg-orange-900/50 text-orange-300 border-orange-700",
  unknown:       "bg-gray-800 text-gray-400 border-gray-700",
  invalid:       "bg-red-900/50 text-red-400 border-red-700",
}

const SOURCE_LABELS: Record<ProspectSource, string> = {
  ai_research: "AI Research",
  manual:      "Manual",
  referral:    "Referral",
  inbound:     "Inbound",
  imported:    "Imported",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fitScoreColor(score: number | null) {
  if (score == null) return "text-gray-500"
  if (score >= 80) return "text-green-400"
  if (score >= 60) return "text-yellow-400"
  if (score >= 40) return "text-orange-400"
  return "text-red-400"
}

function splitLines(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/\n/)
    .map(l => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function toInputDate(d: string | null) {
  if (!d) return ""
  return new Date(d).toISOString().split("T")[0]
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProspectDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "notes">("overview")

  // Action states
  const [researchLoading, setResearchLoading] = useState(false)
  const [outreachLoading, setOutreachLoading] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  // Outreach modal
  const [outreachResult, setOutreachResult] = useState<OutreachResult | null>(null)
  const [outreachSubject, setOutreachSubject] = useState("")
  const [outreachBody, setOutreachBody] = useState("")
  const [copied, setCopied] = useState(false)

  // Notes
  const [noteDraft, setNoteDraft] = useState("")
  const [noteLoading, setNoteLoading] = useState(false)

  // Contacts inline add form
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({
    name: "", title: "", email: "", emailConfidence: "", linkedinUrl: "", notes: "",
  })
  const [contactLoading, setContactLoading] = useState(false)

  // Right column quick edits
  const [outreachDateEdit, setOutreachDateEdit] = useState("")
  const [replyDateEdit, setReplyDateEdit] = useState("")
  const [pipelineEdit, setPipelineEdit] = useState("")
  const [savingField, setSavingField] = useState<string | null>(null)

  // ── Data fetch ────────────────────────────────────────────────────────────────

  const loadProspect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${id}`)
      const json = await res.json() as { prospect?: Prospect; error?: string }
      if (!res.ok || !json.prospect) {
        setError(json.error ?? "Failed to load prospect")
        return
      }
      const p = json.prospect
      setProspect(p)
      setOutreachDateEdit(toInputDate(p.lastOutreachDate))
      setReplyDateEdit(toInputDate(p.lastReplyDate))
      setPipelineEdit(p.pipelineStage ?? "")
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void loadProspect() }, [loadProspect])

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function handleResearchAgain() {
    if (researchLoading) return
    setResearchLoading(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${id}/research`, { method: "POST" })
      if (res.ok) { await loadProspect() }
    } finally {
      setResearchLoading(false)
    }
  }

  async function handleGenerateOutreach() {
    if (outreachLoading) return
    setOutreachLoading(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${id}/outreach`, { method: "POST" })
      const json = await res.json() as OutreachResult & { error?: string }
      if (!res.ok || json.error) return
      setOutreachResult(json)
      setOutreachSubject(json.subject)
      setOutreachBody(json.bodyText)
    } finally {
      setOutreachLoading(false)
    }
  }

  async function handleStatusChange(status: ProspectCrmStatus) {
    if (!prospect || statusChanging) return
    setStatusChanging(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentCrmStatus: status }),
      })
      if (res.ok) {
        setProspect(p => p ? { ...p, currentCrmStatus: status } : p)
      }
    } finally {
      setStatusChanging(false)
    }
  }

  async function handlePatchField(field: string, value: string | null) {
    setSavingField(field)
    try {
      await fetch(`/api/super-admin/crm/prospects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      await loadProspect()
    } finally {
      setSavingField(null)
    }
  }

  async function handleAddNote() {
    if (!noteDraft.trim() || noteLoading) return
    setNoteLoading(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "add_note",
          noteText: noteDraft.trim(),
          createdBy: "Super Admin",
        }),
      })
      const json = await res.json() as { note?: ProspectNote }
      if (res.ok && json.note) {
        setProspect(p => p ? { ...p, notes: [json.note!, ...p.notes] } : p)
        setNoteDraft("")
      }
    } finally {
      setNoteLoading(false)
    }
  }

  async function handleAddContact() {
    if (!contactForm.name.trim() || contactLoading) return
    setContactLoading(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "add_contact",
          contact: {
            name:            contactForm.name.trim(),
            title:           contactForm.title   || undefined,
            email:           contactForm.email   || undefined,
            emailConfidence: contactForm.emailConfidence || undefined,
            linkedinUrl:     contactForm.linkedinUrl || undefined,
            notes:           contactForm.notes   || undefined,
          },
        }),
      })
      const json = await res.json() as { contact?: ProspectContact }
      if (res.ok && json.contact) {
        setProspect(p => p ? { ...p, contacts: [...p.contacts, json.contact!] } : p)
        setContactForm({ name: "", title: "", email: "", emailConfidence: "", linkedinUrl: "", notes: "" })
        setShowAddContact(false)
      }
    } finally {
      setContactLoading(false)
    }
  }

  async function handleDeleteContact(contactId: string) {
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete_contact", contactId }),
      })
      if (res.ok) {
        setProspect(p => p ? { ...p, contacts: p.contacts.filter(c => c.id !== contactId) } : p)
      }
    } catch { /* ignore */ }
  }

  function handleCopyEmail() {
    void navigator.clipboard.writeText(`Subject: ${outreachSubject}\n\n${outreachBody}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading / error states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (error || !prospect) {
    return (
      <div className="p-8">
        <Link href="/super-admin/crm/prospects"
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Prospects
        </Link>
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 text-red-300 text-sm">
          {error ?? "Prospect not found"}
        </div>
      </div>
    )
  }

  const firstContactEmail = prospect.contacts.find(c => c.email)?.email ?? ""

  return (
    <div className="p-6 md:p-8 max-w-[1400px] space-y-6">

      {/* Back */}
      <Link href="/super-admin/crm/prospects"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Prospects
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-white leading-tight">{prospect.companyName}</h1>
          {prospect.duplicateFlag && (
            <span className="self-center text-xs px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-800">
              Duplicate flagged
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {prospect.website && (
            <a
              href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {prospect.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}
          {prospect.linkedinUrl && (
            <a href={prospect.linkedinUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors">
              <Link2 className="w-3.5 h-3.5" /> LinkedIn
            </a>
          )}
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[prospect.currentCrmStatus]}`}>
            {CRM_STATUSES.find(s => s.value === prospect.currentCrmStatus)?.label ?? prospect.currentCrmStatus}
          </span>
          {prospect.aiFitScore != null && (
            <span className={`text-sm font-bold ${fitScoreColor(prospect.aiFitScore)}`}>
              Fit: {prospect.aiFitScore}/100
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => void handleGenerateOutreach()}
          disabled={outreachLoading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {outreachLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Mail className="w-4 h-4" />}
          Generate Outreach Email
        </button>

        <button
          onClick={() => void handleResearchAgain()}
          disabled={researchLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 border border-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          {researchLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Research Again
        </button>

        <StatusDropdown
          current={prospect.currentCrmStatus}
          onChange={(s) => void handleStatusChange(s)}
          loading={statusChanging}
        />

        <button
          onClick={() => setActiveTab("notes")}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          <StickyNote className="w-4 h-4" /> Add Note
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Tabs ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Tab bar */}
          <div className="flex border-b border-gray-800">
            {(["overview", "contacts", "notes"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab === "contacts"
                  ? `Contacts (${prospect.contacts.length})`
                  : tab === "notes"
                  ? `Notes (${prospect.notes.length})`
                  : "Overview"}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-4">

              {prospect.researchSummary && (
                <SectionCard title="AI Research Summary" icon={<Zap className="w-4 h-4 text-indigo-400" />}>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {prospect.researchSummary}
                  </p>
                </SectionCard>
              )}

              {prospect.operationalPainPoints && (
                <SectionCard title="Operational Pain Points">
                  <BulletList items={splitLines(prospect.operationalPainPoints)} />
                </SectionCard>
              )}

              {prospect.relayFitReasons && (
                <SectionCard title="Why Relay Fits">
                  <BulletList items={splitLines(prospect.relayFitReasons)} color="text-green-300" />
                </SectionCard>
              )}

              {prospect.suggestedDemoEmphasis && (
                <SectionCard title="Suggested Demo Emphasis">
                  <BulletList items={splitLines(prospect.suggestedDemoEmphasis)} color="text-blue-300" />
                </SectionCard>
              )}

              {prospect.suggestedOutreachAngle && (
                <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">
                    Suggested Outreach Angle
                  </p>
                  <p className="text-sm text-indigo-200 leading-relaxed">{prospect.suggestedOutreachAngle}</p>
                </div>
              )}

              {prospect.decisionMakerTitles.length > 0 && (
                <SectionCard title="Decision Maker Titles">
                  <div className="flex flex-wrap gap-2">
                    {prospect.decisionMakerTitles.map(title => (
                      <span key={title}
                        className="px-2.5 py-1 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">
                        {title}
                      </span>
                    ))}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Company Details" icon={<Building2 className="w-4 h-4 text-gray-400" />}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <DetailRow label="Industry"   value={prospect.industry} />
                  <DetailRow label="Employees"  value={
                    prospect.employeeCountMin != null || prospect.employeeCountMax != null
                      ? [prospect.employeeCountMin, prospect.employeeCountMax]
                          .filter(v => v != null).join(" – ")
                      : null
                  } />
                  <DetailRow label="Locations"  value={prospect.locationsCount != null ? String(prospect.locationsCount) : null} />
                  <DetailRow label="HQ"         value={
                    [prospect.headquartersCity, prospect.headquartersState]
                      .filter(Boolean).join(", ") || null
                  } />
                  <DetailRow label="Country"    value={prospect.headquartersCountry} />
                  <DetailRow label="Source"     value={SOURCE_LABELS[prospect.source]} />
                </div>
              </SectionCard>

              {prospect.confidenceScore != null && (
                <SectionCard title="AI Confidence Score">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Data confidence</span>
                      <span className="text-sm font-medium text-white">{prospect.confidenceScore}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          prospect.confidenceScore >= 70 ? "bg-green-500" :
                          prospect.confidenceScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${prospect.confidenceScore}%` }}
                      />
                    </div>
                  </div>
                </SectionCard>
              )}

              {!prospect.researchSummary && !prospect.operationalPainPoints && (
                <div className="bg-gray-900 border border-dashed border-gray-800 rounded-xl p-8 text-center">
                  <Zap className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-3">No AI research data yet.</p>
                  <button
                    onClick={() => void handleResearchAgain()}
                    disabled={researchLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {researchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Research Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── CONTACTS TAB ─────────────────────────────────────────────────── */}
          {activeTab === "contacts" && (
            <div className="space-y-3">
              {prospect.contacts.length === 0 && !showAddContact && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                  <User className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No contacts yet.</p>
                </div>
              )}

              {prospect.contacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onDelete={() => void handleDeleteContact(contact.id)}
                />
              ))}

              {showAddContact ? (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white">New Contact</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Name *</label>
                      <input
                        value={contactForm.name}
                        onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Full name"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Title</label>
                      <input
                        value={contactForm.title}
                        onChange={e => setContactForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Job title"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@company.com"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email Confidence</label>
                      <select
                        value={contactForm.emailConfidence}
                        onChange={e => setContactForm(f => ({ ...f, emailConfidence: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— select —</option>
                        <option value="verified">Verified</option>
                        <option value="accepts_mail">Accepts Mail</option>
                        <option value="catch_all">Catch-All</option>
                        <option value="risky">Risky</option>
                        <option value="unknown">Unknown</option>
                        <option value="invalid">Invalid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">LinkedIn URL</label>
                      <input
                        value={contactForm.linkedinUrl}
                        onChange={e => setContactForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Notes</label>
                      <textarea
                        value={contactForm.notes}
                        onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional notes about this contact"
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleAddContact()}
                      disabled={!contactForm.name.trim() || contactLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {contactLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Plus className="w-3.5 h-3.5" />}
                      Add Contact
                    </button>
                    <button
                      onClick={() => {
                        setShowAddContact(false)
                        setContactForm({ name: "", title: "", email: "", emailConfidence: "", linkedinUrl: "", notes: "" })
                      }}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddContact(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-700 hover:border-indigo-600 text-gray-500 hover:text-indigo-400 text-sm rounded-xl w-full transition-colors justify-center"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
              )}
            </div>
          )}

          {/* ── NOTES TAB ────────────────────────────────────────────────────── */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleAddNote() }}
                  placeholder="Add a note... (Cmd+Enter to submit)"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-600 text-xs">Cmd+Enter to submit</span>
                  <button
                    onClick={() => void handleAddNote()}
                    disabled={!noteDraft.trim() || noteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {noteLoading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Plus className="w-3.5 h-3.5" />}
                    Add Note
                  </button>
                </div>
              </div>

              {prospect.notes.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                  <MessageSquare className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No notes yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prospect.notes.map(note => (
                    <div key={note.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{note.noteText}</p>
                      <div className="flex items-center gap-2 mt-3">
                        {note.createdBy && (
                          <>
                            <span className="text-xs text-indigo-400 font-medium">{note.createdBy}</span>
                            <span className="text-gray-700">·</span>
                          </>
                        )}
                        <span className="text-xs text-gray-500">{fmtDate(note.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ──────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* CRM Status */}
          <SectionCard title="CRM Status">
            <div className="space-y-3">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${STATUS_COLORS[prospect.currentCrmStatus]}`}>
                <span className="w-2 h-2 rounded-full bg-current opacity-70 shrink-0" />
                {CRM_STATUSES.find(s => s.value === prospect.currentCrmStatus)?.label}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-600 mb-1">Change to:</p>
                {CRM_STATUSES.filter(s => s.value !== prospect.currentCrmStatus).map(s => (
                  <button
                    key={s.value}
                    onClick={() => void handleStatusChange(s.value)}
                    disabled={statusChanging}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Fit Score */}
          {prospect.aiFitScore != null && (
            <SectionCard title="Fit Score">
              <div className="text-center py-2">
                <span className={`text-5xl font-bold ${fitScoreColor(prospect.aiFitScore)}`}>
                  {prospect.aiFitScore}
                </span>
                <span className="text-gray-600 text-xl">/100</span>
                <p className="text-xs text-gray-500 mt-2">
                  {prospect.aiFitScore >= 80 ? "Strong fit" :
                   prospect.aiFitScore >= 60 ? "Good fit" :
                   prospect.aiFitScore >= 40 ? "Moderate fit" : "Weak fit"}
                </p>
              </div>
            </SectionCard>
          )}

          {/* Dates */}
          <SectionCard title="Dates">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Date Researched</span>
                <span className="text-xs text-gray-300">{fmtDate(prospect.dateResearched)}</span>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Last Outreach</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={outreachDateEdit}
                    onChange={e => setOutreachDateEdit(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => void handlePatchField("lastOutreachDate", outreachDateEdit || null)}
                    disabled={savingField === "lastOutreachDate"}
                    className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingField === "lastOutreachDate"
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : "Save"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Last Reply</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={replyDateEdit}
                    onChange={e => setReplyDateEdit(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => void handlePatchField("lastReplyDate", replyDateEdit || null)}
                    disabled={savingField === "lastReplyDate"}
                    className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingField === "lastReplyDate"
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Pipeline Stage */}
          <SectionCard title="Pipeline Stage">
            <div className="flex gap-2">
              <input
                value={pipelineEdit}
                onChange={e => setPipelineEdit(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void handlePatchField("pipelineStage", pipelineEdit || null) }}
                placeholder="e.g. Cold, Warm, Hot"
                className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => void handlePatchField("pipelineStage", pipelineEdit || null)}
                disabled={savingField === "pipelineStage"}
                className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingField === "pipelineStage"
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : "Save"}
              </button>
            </div>
          </SectionCard>

          {/* Source */}
          <SectionCard title="Source">
            <span className="inline-flex items-center px-2.5 py-1 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">
              {SOURCE_LABELS[prospect.source]}
            </span>
          </SectionCard>

          {/* Assigned To */}
          {prospect.assignedToName && (
            <SectionCard title="Assigned To">
              <p className="text-sm text-gray-300">{prospect.assignedToName}</p>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Outreach Email Modal */}
      {outreachResult && (
        <OutreachModal
          subject={outreachSubject}
          body={outreachBody}
          followUpSubjects={outreachResult.followUpSubjects}
          onSubjectChange={setOutreachSubject}
          onBodyChange={setOutreachBody}
          onCopy={handleCopyEmail}
          copied={copied}
          contactEmail={firstContactEmail}
          onClose={() => setOutreachResult(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionCard({
  title, icon, children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function BulletList({ items, color = "text-gray-300" }: { items: string[]; color?: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-600">—</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className={`flex items-start gap-2 text-sm ${color}`}>
          <span className="text-gray-600 mt-0.5 shrink-0">•</span>
          <span className="leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-sm text-gray-300">{value ?? "—"}</span>
    </div>
  )
}

function ContactCard({
  contact, onDelete,
}: {
  contact: ProspectContact
  onDelete: () => void
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 group">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{contact.name}</p>
            {contact.title && (
              <span className="text-xs text-gray-500">{contact.title}</span>
            )}
          </div>
          {contact.email && (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`mailto:${contact.email}`}
                className="text-xs text-indigo-400 hover:underline">
                {contact.email}
              </a>
              {contact.emailConfidence && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${EMAIL_CONFIDENCE_COLORS[contact.emailConfidence] ?? EMAIL_CONFIDENCE_COLORS.unknown}`}>
                  {contact.emailConfidence.replace(/_/g, " ")}
                </span>
              )}
            </div>
          )}
          {contact.linkedinUrl && (
            <a href={contact.linkedinUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              <Link2 className="w-3 h-3" /> LinkedIn
            </a>
          )}
          {contact.notes && (
            <p className="text-xs text-gray-500 leading-relaxed">{contact.notes}</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1 shrink-0"
          title="Delete contact"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function StatusDropdown({
  current, onChange, loading,
}: {
  current: ProspectCrmStatus
  onChange: (s: ProspectCrmStatus) => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Mark Status
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
            {CRM_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                  s.value === current ? "text-indigo-400 font-medium" : "text-gray-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OutreachModal({
  subject, body, followUpSubjects, onSubjectChange, onBodyChange,
  onCopy, copied, contactEmail, onClose,
}: {
  subject: string
  body: string
  followUpSubjects: string[]
  onSubjectChange: (v: string) => void
  onBodyChange: (v: string) => void
  onCopy: () => void
  copied: boolean
  contactEmail: string
  onClose: () => void
}) {
  const composerHref =
    `/super-admin/crm/email?compose=1` +
    (contactEmail ? `&to=${encodeURIComponent(contactEmail)}` : "") +
    `&subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Generated Outreach Draft</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={e => onSubjectChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Body</label>
            <textarea
              value={body}
              onChange={e => onBodyChange(e.target.value)}
              rows={12}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
            />
          </div>

          {followUpSubjects.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Follow-up Sequence
              </p>
              <div className="space-y-2">
                {followUpSubjects.map((fu, i) => (
                  <div key={i}
                    className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5">
                    <span className="text-[10px] text-gray-600 font-mono mt-0.5 shrink-0 w-14">
                      {i === 0 ? "Day 3–5" : i === 1 ? "Day 7–10" : "Day 14+"}
                    </span>
                    <span className="text-xs text-gray-300 leading-snug">{fu}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              {copied
                ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <Link
              href={composerHref}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Open in CRM Composer
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
