"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2, ArrowLeft, Globe, Phone, MapPin, Users, Briefcase,
  Plus, CheckCircle2, Circle, Mail, ChevronDown, ChevronUp,
  Edit3, Save, ExternalLink, Link2, Star, Shield, Zap,
  FileText, AlertCircle, ArrowUpRight, ArrowDownLeft,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string; name: string; title: string | null; email: string | null
  phone: string | null; linkedinUrl: string | null; department: string | null
  jobLevel: string | null; isPrimaryContact: boolean; isDecisionMaker: boolean
  isChampion: boolean; notes: string | null; createdAt: string
}

interface Opportunity {
  id: string; title: string; stage: string; value: string | null; wonAt: string | null
  lostAt: string | null; nextStep: string | null; nextStepDate: string | null
  createdAt: string; updatedAt: string
  assignedTo: { id: string; name: string } | null
  contact:    { id: string; name: string; title: string | null } | null
}

interface Activity {
  id: string; activityType: string; subject: string | null; notes: string | null
  outcome: string | null; durationMinutes: number | null; occurredAt: string
  salesUser: { id: string; name: string } | null
  contact:   { id: string; name: string } | null
}

interface Task {
  id: string; title: string; taskType: string; priority: string
  dueAt: string | null; completedAt: string | null; notes: string | null
  assignedTo: { id: string; name: string }
  contact:    { id: string; name: string } | null
}

interface Email {
  id: string; direction: "sent" | "received"; subject: string
  bodyText: string; bodyHtml: string; sentAt: string
  fromAddress: string; toAddress: string; isRead: boolean
  openedAt: string | null; openCount: number; sentiment: string | null
  isArchived: boolean
  contact: { id: string; name: string } | null
}

interface Note { id: string; noteText: string; createdAt: string }

interface Company {
  id: string; companyName: string; website: string | null; industry: string | null
  phone: string | null; description: string | null; tags: string[]
  headquartersCity: string | null; headquartersState: string | null
  linkedinUrl: string | null; currentCrmStatus: string; aiFitScore: number | null
  employeeCountMin: number | null; employeeCountMax: number | null
  researchSummary: string | null; productInterest: string | null; updatedAt: string
  operationalPainPoints: string | null; relayFitReasons: string | null; suggestedOutreachAngle: string | null
  assignedTo: { id: string; name: string; email: string } | null
  contacts:   Contact[]; notes: Note[]; opportunities: Opportunity[]
  salesActivities: Activity[]; tasks: Task[]; emails: Email[]
  demoCalls: { id: string; companyName: string; callStatus: string; scheduledAt: string | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS = ["Timeline", "Contacts", "Opportunities", "Tasks", "Profile"] as const
type Tab = typeof TABS[number]

const STATUS_LABELS: Record<string, string> = {
  researched: "Researched", contacted: "Contacted", replied: "Replied",
  demo_scheduled: "Demo Scheduled", trial: "Trial", customer: "Customer",
  not_interested: "Not Interested", do_not_contact: "Do Not Contact",
}
const STATUS_STYLES: Record<string, string> = {
  researched: "text-blue-400 bg-blue-900/30", contacted: "text-indigo-400 bg-indigo-900/30",
  replied: "text-emerald-400 bg-emerald-900/30", demo_scheduled: "text-green-400 bg-green-900/30",
  trial: "text-purple-400 bg-purple-900/30", customer: "text-teal-400 bg-teal-900/30",
  not_interested: "text-gray-500 bg-gray-800/60", do_not_contact: "text-red-400 bg-red-900/30",
}
const STAGE_STYLES: Record<string, string> = {
  Qualified: "text-blue-400 bg-blue-900/30", Demo: "text-indigo-400 bg-indigo-900/30",
  Proposal: "text-yellow-400 bg-yellow-900/30", Negotiating: "text-orange-400 bg-orange-900/30",
  "Closed Won": "text-emerald-400 bg-emerald-900/30", "Closed Lost": "text-gray-500 bg-gray-800/60",
}
const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  EMAIL_SENT:      { icon: "📤", color: "text-blue-400"    },
  EMAIL_RECEIVED:  { icon: "📥", color: "text-emerald-400" },
  CALL_ATTEMPTED:  { icon: "📞", color: "text-yellow-400"  },
  CALL_CONNECTED:  { icon: "✅", color: "text-green-400"   },
  MEETING_HELD:    { icon: "📅", color: "text-purple-400"  },
  NOTE_ADDED:      { icon: "📝", color: "text-gray-400"    },
  LINKEDIN_VIEW:   { icon: "💼", color: "text-blue-500"    },
  LINKEDIN_MESSAGE:{ icon: "💬", color: "text-blue-400"    },
  DEMO_COMPLETED:  { icon: "🎯", color: "text-teal-400"    },
  TASK_COMPLETED:  { icon: "✔",  color: "text-gray-400"    },
  STATUS_CHANGED:  { icon: "🔄", color: "text-gray-500"    },
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function fmtTime(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompanyHub({
  company: initialCompany,
  salesUsers,
  currentUserId,
  isManager,
}: {
  company:      Company
  salesUsers:   { id: string; name: string }[]
  currentUserId: string | null
  isManager:    boolean
}) {
  const router = useRouter()
  const [company, setCompany]     = useState(initialCompany)
  const [tab, setTab]             = useState<Tab>("Timeline")
  const [saving, setSaving]       = useState(false)

  // ── Profile edit state ──────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft]     = useState({
    companyName: company.companyName,
    website: company.website ?? "",
    phone: company.phone ?? "",
    industry: company.industry ?? "",
    headquartersCity: company.headquartersCity ?? "",
    headquartersState: company.headquartersState ?? "",
    description: company.description ?? "",
    productInterest: company.productInterest ?? "",
    linkedinUrl: company.linkedinUrl ?? "",
    currentCrmStatus: company.currentCrmStatus,
    assignedToId: company.assignedTo?.id ?? "",
  })

  async function saveProfile() {
    setSaving(true)
    try {
      const res  = await fetch(`/api/sales/companies/${company.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileDraft,
          website: profileDraft.website || null,
          phone: profileDraft.phone || null,
          industry: profileDraft.industry || null,
          headquartersCity: profileDraft.headquartersCity || null,
          headquartersState: profileDraft.headquartersState || null,
          description: profileDraft.description || null,
          productInterest: profileDraft.productInterest || null,
          linkedinUrl: profileDraft.linkedinUrl || null,
          assignedToId: profileDraft.assignedToId || null,
        }),
      })
      const data = await res.json() as { company: Company }
      setCompany(c => ({ ...c, ...data.company }))
      setEditingProfile(false)
    } finally { setSaving(false) }
  }

  // ── Note state ──────────────────────────────────────────────────────────────
  const [noteText, setNoteText]   = useState("")
  const [addingNote, setAddingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  async function saveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/super-admin/crm/prospects/${company.id}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText: noteText.trim() }),
      })
      if (res.ok) {
        const data = await res.json() as { note: Note }
        setCompany(c => ({ ...c, notes: [data.note, ...c.notes] }))
        setNoteText(""); setAddingNote(false)
      }
    } finally { setSavingNote(false) }
  }

  // ── Contact state ───────────────────────────────────────────────────────────
  const [addingContact, setAddingContact] = useState(false)
  const [contactForm, setContactForm]     = useState({ name: "", title: "", email: "", phone: "", linkedinUrl: "", isDecisionMaker: false, isPrimaryContact: false })
  const [savingContact, setSavingContact] = useState(false)
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null)

  async function createContact() {
    if (!contactForm.name.trim()) return
    setSavingContact(true)
    try {
      const res = await fetch(`/api/sales/companies/${company.id}/contacts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      })
      if (res.ok) {
        const data = await res.json() as { contact: Contact }
        setCompany(c => ({ ...c, contacts: [...c.contacts, data.contact] }))
        setAddingContact(false); setContactForm({ name: "", title: "", email: "", phone: "", linkedinUrl: "", isDecisionMaker: false, isPrimaryContact: false })
      }
    } finally { setSavingContact(false) }
  }

  // ── Task state ──────────────────────────────────────────────────────────────
  const [addingTask, setAddingTask]       = useState(false)
  const [taskForm, setTaskForm]           = useState({ title: "", taskType: "other", priority: "normal", dueAt: "", notes: "" })
  const [savingTask, setSavingTask]       = useState(false)
  const [completingTask, setCompletingTask] = useState<string | null>(null)

  async function createTask() {
    if (!taskForm.title.trim()) return
    setSavingTask(true)
    try {
      const res = await fetch("/api/sales/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...taskForm, prospectId: company.id, assignedToId: currentUserId }),
      })
      if (res.ok) {
        router.refresh()
        setAddingTask(false); setTaskForm({ title: "", taskType: "other", priority: "normal", dueAt: "", notes: "" })
      }
    } finally { setSavingTask(false) }
  }

  async function completeTask(taskId: string) {
    setCompletingTask(taskId)
    try {
      await fetch(`/api/sales/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      })
      setCompany(c => ({ ...c, tasks: c.tasks.map(t => t.id === taskId ? { ...t, completedAt: new Date().toISOString() } : t) }))
    } finally { setCompletingTask(null) }
  }

  // ── Activity log state ──────────────────────────────────────────────────────
  const [addingActivity, setAddingActivity] = useState(false)
  const [actForm, setActForm] = useState({ activityType: "CALL_ATTEMPTED", subject: "", notes: "", outcome: "", durationMinutes: "" })
  const [savingActivity, setSavingActivity] = useState(false)

  async function logActivity() {
    setSavingActivity(true)
    try {
      const res = await fetch("/api/sales/activities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: company.id,
          activityType: actForm.activityType,
          subject: actForm.subject || null,
          notes: actForm.notes || null,
          outcome: actForm.outcome || null,
          durationMinutes: actForm.durationMinutes ? parseInt(actForm.durationMinutes) : null,
        }),
      })
      if (res.ok) {
        router.refresh()
        setAddingActivity(false); setActForm({ activityType: "CALL_ATTEMPTED", subject: "", notes: "", outcome: "", durationMinutes: "" })
      }
    } finally { setSavingActivity(false) }
  }

  // ── Build merged timeline ───────────────────────────────────────────────────
  type TimelineItem =
    | { type: "activity"; data: Activity }
    | { type: "email";    data: Email }
    | { type: "note";     data: Note }

  const timeline: TimelineItem[] = [
    ...company.salesActivities.map(a => ({ type: "activity" as const, data: a, ts: new Date(a.occurredAt).getTime() })),
    ...company.emails.map(e => ({ type: "email" as const, data: e, ts: new Date(e.sentAt).getTime() })),
    ...company.notes.map(n => ({ type: "note" as const, data: n, ts: new Date(n.createdAt).getTime() })),
  ].sort((a, b) => b.ts - a.ts)

  const openOpps  = company.opportunities.filter(o => o.stage !== "Closed Won" && o.stage !== "Closed Lost")
  const openTasks = company.tasks.filter(t => !t.completedAt)
  const now       = new Date()

  return (
    <div className="p-6 max-w-6xl">
      {/* Back + header */}
      <div className="mb-5">
        <Link href="/sales/companies" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Companies
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-900/40 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{company.companyName}</h1>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_STYLES[company.currentCrmStatus] ?? "text-gray-400 bg-gray-800")}>
                  {STATUS_LABELS[company.currentCrmStatus] ?? company.currentCrmStatus}
                </span>
                {company.aiFitScore != null && (
                  <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    Fit {company.aiFitScore}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-500">
                {company.industry && <span>{company.industry}</span>}
                {(company.headquartersCity || company.headquartersState) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[company.headquartersCity, company.headquartersState].filter(Boolean).join(", ")}
                  </span>
                )}
                {company.website && (
                  <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 hover:text-white transition-colors">
                    <Globe className="w-3 h-3" /> {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
                {company.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{company.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {openOpps.length > 0 && (
              <Link
                href={`/sales/opportunities/${openOpps[0].id}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-400 text-sm rounded-lg transition-colors"
              >
                <Briefcase className="w-3.5 h-3.5" />
                {openOpps[0].stage}
              </Link>
            )}
            <Link
              href={`/sales/opportunities/new?company=${encodeURIComponent(company.companyName)}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" /> New Opp
            </Link>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Contacts",     value: company.contacts.length,       icon: <Users className="w-4 h-4 text-indigo-400" /> },
          { label: "Open Opps",    value: openOpps.length,               icon: <Briefcase className="w-4 h-4 text-emerald-400" /> },
          { label: "Open Tasks",   value: openTasks.length,              icon: <CheckCircle2 className="w-4 h-4 text-yellow-400" />, alert: openTasks.some(t => t.dueAt && new Date(t.dueAt) < now) },
          { label: "Activities",   value: company.salesActivities.length,icon: <Zap className="w-4 h-4 text-blue-400" /> },
        ].map(stat => (
          <div key={stat.label} className={cn("bg-gray-900 border rounded-xl p-3 flex items-center gap-3", stat.alert ? "border-red-800/40" : "border-gray-800")}>
            {stat.icon}
            <div>
              <p className={cn("text-xl font-bold", stat.alert ? "text-red-400" : "text-white")}>{stat.value}</p>
              <p className="text-[10px] text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-800">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t ? "border-indigo-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab: Timeline ─────────────────────────────────────────────────── */}
      {tab === "Timeline" && (
        <div className="space-y-4">
          {/* Quick action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setAddingActivity(true); setAddingNote(false); setAddingTask(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Log Activity
            </button>
            <button
              onClick={() => { setAddingNote(true); setAddingActivity(false); setAddingTask(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" /> Add Note
            </button>
            <button
              onClick={() => { setAddingTask(true); setAddingNote(false); setAddingActivity(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Add Task
            </button>
            <Link
              href={`/sales/outreach/email?demoCallId=${company.demoCalls[0]?.id ?? ""}&to=${company.contacts[0]?.email ?? ""}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400" /> Send Email
            </Link>
          </div>

          {/* Log Activity form */}
          {addingActivity && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-white">Log Activity</p>
              <div className="grid grid-cols-2 gap-3">
                <select value={actForm.activityType} onChange={e => setActForm(f => ({ ...f, activityType: e.target.value }))}
                  className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                  {["CALL_ATTEMPTED","CALL_CONNECTED","MEETING_HELD","LINKEDIN_MESSAGE","LINKEDIN_VIEW","NOTE_ADDED","DEMO_COMPLETED"].map(t =>
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
                <input placeholder="Subject / topic (optional)" value={actForm.subject} onChange={e => setActForm(f => ({ ...f, subject: e.target.value }))}
                  className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <input placeholder="Outcome (e.g. Left voicemail)" value={actForm.outcome} onChange={e => setActForm(f => ({ ...f, outcome: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <input type="number" placeholder="Duration (mins)" value={actForm.durationMinutes} onChange={e => setActForm(f => ({ ...f, durationMinutes: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <textarea placeholder="Notes…" value={actForm.notes} onChange={e => setActForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={logActivity} disabled={savingActivity}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  Save
                </button>
                <button onClick={() => setAddingActivity(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Add Note form */}
          {addingNote && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-white">Add Note</p>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} placeholder="Note…"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500" />
              <div className="flex gap-2">
                <button onClick={saveNote} disabled={savingNote || !noteText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  Save Note
                </button>
                <button onClick={() => { setAddingNote(false); setNoteText("") }} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Add Task form */}
          {addingTask && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-white">Add Task</p>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Task title *" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <select value={taskForm.taskType} onChange={e => setTaskForm(f => ({ ...f, taskType: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                  {["call","email","linkedin","proposal","contract","other"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                  {["high","normal","low"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="date" value={taskForm.dueAt} onChange={e => setTaskForm(f => ({ ...f, dueAt: e.target.value }))}
                  className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={createTask} disabled={savingTask || !taskForm.title.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  Add Task
                </button>
                <button onClick={() => setAddingTask(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Timeline feed */}
          {timeline.length === 0 ? (
            <p className="text-gray-600 text-sm py-8 text-center">No activity yet. Log a call, send an email, or add a note above.</p>
          ) : (
            <div className="space-y-2">
              {timeline.map((item, i) => {
                if (item.type === "note") {
                  return (
                    <div key={`note-${item.data.id}`} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm shrink-0 mt-0.5">📝</div>
                      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Note · {fmtTime((item.data as Note).createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{(item.data as Note).noteText}</p>
                      </div>
                    </div>
                  )
                }
                if (item.type === "activity") {
                  const act = item.data as Activity
                  const { icon, color } = ACTIVITY_ICONS[act.activityType] ?? { icon: "📋", color: "text-gray-400" }
                  return (
                    <div key={`act-${act.id}-${i}`} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm shrink-0 mt-0.5">{icon}</div>
                      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-0.5 flex-wrap gap-2">
                          <span className={cn("text-xs font-medium", color)}>{act.activityType.replace(/_/g, " ")}</span>
                          <span className="text-xs text-gray-600">{fmtTime(act.occurredAt)} · {act.salesUser?.name ?? "unknown"}</span>
                        </div>
                        {act.subject && <p className="text-sm font-medium text-white">{act.subject}</p>}
                        {act.outcome && <p className="text-xs text-gray-400 mt-0.5">Outcome: {act.outcome}</p>}
                        {act.notes   && <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{act.notes}</p>}
                        {act.durationMinutes && <p className="text-xs text-gray-600 mt-0.5">{act.durationMinutes} min</p>}
                        {act.contact && <p className="text-xs text-indigo-400 mt-0.5">With {act.contact.name}</p>}
                      </div>
                    </div>
                  )
                }
                // email
                const em = item.data as Email
                return (
                  <div key={`email-${em.id}`} className="flex gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5", em.direction === "sent" ? "bg-indigo-900/40" : "bg-blue-900/40")}>
                      {em.direction === "sent" ? <ArrowUpRight className="w-4 h-4 text-indigo-400" /> : <ArrowDownLeft className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-0.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400">{em.direction === "sent" ? "Email sent" : "Email received"}</span>
                          {em.sentiment && (
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", em.sentiment === "positive" ? "bg-emerald-900/40 text-emerald-400" : em.sentiment === "negative" ? "bg-red-900/30 text-red-400" : "bg-gray-800 text-gray-500")}>
                              {em.sentiment}
                            </span>
                          )}
                          {em.openedAt && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />opened</span>}
                        </div>
                        <span className="text-xs text-gray-600">{fmtTime(em.sentAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{em.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{em.bodyText.slice(0, 150)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Contacts ──────────────────────────────────────────────────── */}
      {tab === "Contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{company.contacts.length} contact{company.contacts.length !== 1 ? "s" : ""}</p>
            <button onClick={() => setAddingContact(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Contact
            </button>
          </div>

          {addingContact && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-white">New Contact</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { placeholder: "Full name *", key: "name" },
                  { placeholder: "Job title",   key: "title" },
                  { placeholder: "Email",        key: "email" },
                  { placeholder: "Phone",        key: "phone" },
                  { placeholder: "LinkedIn URL", key: "linkedinUrl" },
                ].map(f => (
                  <input key={f.key} placeholder={f.placeholder}
                    value={(contactForm as unknown as Record<string, string>)[f.key] ?? ""}
                    onChange={e => setContactForm(fc => ({ ...fc, [f.key]: e.target.value }))}
                    className="col-span-2 md:col-span-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                ))}
                <div className="col-span-2 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={contactForm.isDecisionMaker}
                      onChange={e => setContactForm(f => ({ ...f, isDecisionMaker: e.target.checked }))}
                      className="accent-indigo-500" />
                    Decision maker
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={contactForm.isPrimaryContact}
                      onChange={e => setContactForm(f => ({ ...f, isPrimaryContact: e.target.checked }))}
                      className="accent-indigo-500" />
                    Primary contact
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={createContact} disabled={savingContact || !contactForm.name.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  Add
                </button>
                <button onClick={() => setAddingContact(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {company.contacts.length === 0 && !addingContact && (
              <p className="text-gray-600 text-sm py-8 text-center">No contacts yet. Add the people you're working with at this company.</p>
            )}
            {company.contacts.map(c => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  onClick={() => setExpandedContactId(id => id === c.id ? null : c.id)}
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-900/40 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{c.name}</span>
                      {c.isPrimaryContact && <span className="text-[10px] bg-indigo-900/40 text-indigo-300 px-1.5 py-0.5 rounded-full">Primary</span>}
                      {c.isDecisionMaker  && <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />DM</span>}
                      {c.isChampion       && <span className="text-[10px] bg-green-900/40  text-green-400  px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" />Champion</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{[c.title, c.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  {expandedContactId === c.id ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                </div>
                {expandedContactId === c.id && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-800 grid grid-cols-2 gap-3 text-sm">
                    {c.email && (
                      <div>
                        <p className="text-xs text-gray-600 mb-0.5">Email</p>
                        <a href={`mailto:${c.email}`} className="text-indigo-400 hover:underline">{c.email}</a>
                      </div>
                    )}
                    {c.phone && (
                      <div>
                        <p className="text-xs text-gray-600 mb-0.5">Phone</p>
                        <p className="text-gray-300">{c.phone}</p>
                      </div>
                    )}
                    {c.linkedinUrl && (
                      <div>
                        <p className="text-xs text-gray-600 mb-0.5">LinkedIn</p>
                        <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Profile
                        </a>
                      </div>
                    )}
                    {c.department && (
                      <div>
                        <p className="text-xs text-gray-600 mb-0.5">Department</p>
                        <p className="text-gray-300">{c.department}</p>
                      </div>
                    )}
                    {c.jobLevel && (
                      <div>
                        <p className="text-xs text-gray-600 mb-0.5">Level</p>
                        <p className="text-gray-300">{c.jobLevel.replace(/_/g, " ")}</p>
                      </div>
                    )}
                    {c.notes && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600 mb-0.5">Notes</p>
                        <p className="text-gray-400 whitespace-pre-wrap">{c.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Opportunities ─────────────────────────────────────────────── */}
      {tab === "Opportunities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{company.opportunities.length} opportunit{company.opportunities.length !== 1 ? "ies" : "y"}</p>
            <Link
              href={`/sales/opportunities/new?company=${encodeURIComponent(company.companyName)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Opportunity
            </Link>
          </div>
          {company.opportunities.length === 0 ? (
            <p className="text-gray-600 text-sm py-8 text-center">No opportunities yet.</p>
          ) : (
            <div className="space-y-3">
              {company.opportunities.map(opp => (
                <Link key={opp.id} href={`/sales/opportunities/${opp.id}`}
                  className="block bg-gray-900 border border-gray-800 hover:border-indigo-800/40 rounded-xl p-4 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-white">{opp.title}</p>
                      {opp.contact && <p className="text-xs text-gray-500 mt-0.5">{opp.contact.name}{opp.contact.title ? ` · ${opp.contact.title}` : ""}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {opp.value && <span className="text-sm font-semibold text-yellow-400">${Number(opp.value).toLocaleString()}</span>}
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STAGE_STYLES[opp.stage] ?? "text-gray-400 bg-gray-800")}>{opp.stage}</span>
                    </div>
                  </div>
                  {opp.nextStep && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-yellow-500" /> {opp.nextStep}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tasks ─────────────────────────────────────────────────────── */}
      {tab === "Tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{openTasks.length} open task{openTasks.length !== 1 ? "s" : ""}</p>
            <button onClick={() => setAddingTask(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>

          {addingTask && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Task title *" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                <select value={taskForm.taskType} onChange={e => setTaskForm(f => ({ ...f, taskType: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                  {["call","email","linkedin","proposal","contract","other"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="date" value={taskForm.dueAt} onChange={e => setTaskForm(f => ({ ...f, dueAt: e.target.value }))}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={createTask} disabled={savingTask || !taskForm.title.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">Add Task</button>
                <button onClick={() => setAddingTask(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {company.tasks.length === 0 && (
              <p className="text-gray-600 text-sm py-8 text-center">No tasks yet.</p>
            )}
            {company.tasks.map(t => {
              const overdue = !t.completedAt && t.dueAt && new Date(t.dueAt) < now
              return (
                <div key={t.id} className={cn("flex items-start gap-3 bg-gray-900 border rounded-xl p-3 transition-colors", overdue ? "border-red-800/40" : "border-gray-800", t.completedAt && "opacity-50")}>
                  <button
                    onClick={() => !t.completedAt && completeTask(t.id)}
                    disabled={!!t.completedAt || completingTask === t.id}
                    className="mt-0.5 shrink-0"
                  >
                    {t.completedAt
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      : <Circle className={cn("w-5 h-5", overdue ? "text-red-500" : "text-gray-600 hover:text-indigo-400")} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", t.completedAt ? "line-through text-gray-600" : "text-white")}>{t.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {t.taskType} · {t.priority} priority
                      {t.dueAt && ` · due ${fmtDate(t.dueAt)}`}
                      {t.assignedTo && ` · ${t.assignedTo.name}`}
                      {t.contact && ` · re: ${t.contact.name}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Profile ───────────────────────────────────────────────────── */}
      {tab === "Profile" && (
        <div className="space-y-6 max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">Company Profile</p>
            {!editingProfile ? (
              <button onClick={() => setEditingProfile(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveProfile} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => setEditingProfile(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            {editingProfile ? (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Company name", key: "companyName", span: 2 },
                  { label: "Website",      key: "website"           },
                  { label: "Phone",        key: "phone"             },
                  { label: "Industry",     key: "industry"          },
                  { label: "City",         key: "headquartersCity"  },
                  { label: "State",        key: "headquartersState" },
                  { label: "LinkedIn URL", key: "linkedinUrl", span: 2 },
                  { label: "Product interest", key: "productInterest", span: 2 },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? "col-span-2" : ""}>
                    <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                    <input
                      value={(profileDraft as Record<string, string>)[f.key] ?? ""}
                      onChange={e => setProfileDraft(d => ({ ...d, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea value={profileDraft.description} onChange={e => setProfileDraft(d => ({ ...d, description: e.target.value }))} rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select value={profileDraft.currentCrmStatus} onChange={e => setProfileDraft(d => ({ ...d, currentCrmStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {isManager && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Assigned Rep</label>
                    <select value={profileDraft.assignedToId} onChange={e => setProfileDraft(d => ({ ...d, assignedToId: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                      <option value="">Unassigned</option>
                      {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "Website",    value: company.website,                        link: true },
                  { label: "Phone",      value: company.phone                                      },
                  { label: "Industry",   value: company.industry                                   },
                  { label: "Location",   value: [company.headquartersCity, company.headquartersState].filter(Boolean).join(", ") || null },
                  { label: "LinkedIn",   value: company.linkedinUrl,                    link: true },
                  { label: "Employees",  value: company.employeeCountMin != null ? `${company.employeeCountMin}${company.employeeCountMax ? `–${company.employeeCountMax}` : "+"}` : null },
                  { label: "Product interest", value: company.productInterest                      },
                  { label: "Assigned to",value: company.assignedTo?.name                           },
                ].map(f => (
                  <div key={f.label} className={f.label === "Description" ? "col-span-2" : ""}>
                    <dt className="text-xs text-gray-600 mb-0.5">{f.label}</dt>
                    <dd>
                      {f.value
                        ? (f.link
                            ? <a href={f.value.startsWith("http") ? f.value : `https://${f.value}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1 truncate"><ExternalLink className="w-3 h-3 shrink-0" />{f.value}</a>
                            : <span className="text-gray-200">{f.value}</span>)
                        : <span className="text-gray-600">—</span>}
                    </dd>
                  </div>
                ))}
                {company.description && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-600 mb-0.5">Description</dt>
                    <dd className="text-gray-300 whitespace-pre-wrap">{company.description}</dd>
                  </div>
                )}
                {company.researchSummary && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-600 mb-0.5">AI Research Summary</dt>
                    <dd className="text-gray-400 whitespace-pre-wrap text-xs leading-relaxed">{company.researchSummary}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* AI insights */}
          {(company.operationalPainPoints || company.relayFitReasons || company.suggestedOutreachAngle) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Research Insights</p>
              {company.operationalPainPoints && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Operational Pain Points</p>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{company.operationalPainPoints}</p>
                </div>
              )}
              {company.relayFitReasons && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Why Relay Fits</p>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{company.relayFitReasons}</p>
                </div>
              )}
              {company.suggestedOutreachAngle && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Suggested Angle</p>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{company.suggestedOutreachAngle}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

