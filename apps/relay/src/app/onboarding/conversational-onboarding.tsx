"use client"

import { useState, useEffect, useRef, useReducer } from "react"
import { useRouter } from "next/navigation"
import {
  Check, ChevronRight, Building2, Zap,
  MapPin, Users, Network, Loader2, Plus, Trash2,
  Rocket, ArrowRight, PartyPopper, Settings, Upload, AlertCircle,
} from "lucide-react"
import { RelayWordmark } from "@/components/logo"
import { EMPLOYEE_TYPE_PRESETS } from "@/lib/employee-type-presets"
import { INDUSTRY_LABELS } from "@/lib/industry-templates"
import { PLANS } from "@/lib/pricing"
import { useOnboardingSession } from "@/hooks/useOnboardingSession"
import type { PageKey, ActionKey } from "@/lib/page-access"
import type { WizardUpdatePayload } from "@/lib/config-engine/allowlist"

// ─── Types ────────────────────────────────────────────────────────────────────

type ChapterId =
  | "start"
  | "org_info"
  | "issue_types"
  | "locations"
  | "employee_types"
  | "team_invites"
  | "routing"
  | "review"

interface LocationEntry {
  id: string
  name: string
  address: string
  locationType: string
}

interface TeamEntry {
  id: string
  title: string
  role: string
  name: string
  email: string
  employeeTypeId: string
}

interface EmployeeTypeDefEntry {
  id: string
  name: string
  baseRole: string
  pageAccess: PageKey[]
  actions: ActionKey[]
  presetKey: string | null
  canInvite: boolean
  canChangeEmail: boolean
}

interface WizardData {
  companyName: string
  industry: string
  industryOther: string
  companySize: string
  numberOfLocations: string
  packagePlan: string
  issueTypes: string[]
  issueTypeOther: string
  locations: LocationEntry[]
  employeeTypeDefs: EmployeeTypeDefEntry[]
  team: TeamEntry[]
  routing: Record<string, string>
}

type ConvItem =
  | { kind: "ai_msg"; id: string; text: string; error?: boolean }
  | { kind: "typing"; id: string }
  | { kind: "user_msg"; id: string; text: string }
  | { kind: "chapter_card"; id: string; chapter: ChapterId; collapsed: boolean }

type ConvAction =
  | { type: "add"; item: ConvItem }
  | { type: "typing_on" }
  | { type: "collapse"; chapter: ChapterId }
  | { type: "expand"; chapter: ChapterId }
  | { type: "restore"; items: ConvItem[] }

// ─── Constants ────────────────────────────────────────────────────────────────

interface IssueTypeOption { label: string; category: string; dept: string | null }

const ISSUE_TYPES: IssueTypeOption[] = [
  { label: "Maintenance",         category: "MAINTENANCE",         dept: "Maintenance" },
  { label: "Operations",          category: "GENERAL",             dept: "Operations" },
  { label: "Safety",              category: "SAFETY",              dept: "Safety" },
  { label: "Customer Complaints", category: "CUSTOMER_COMPLAINT",  dept: "Customer Service" },
  { label: "Purchasing",          category: "SUPPLY_SHORTAGE",     dept: "Purchasing" },
  { label: "IT",                  category: "FACILITY",            dept: "Information Technology" },
  { label: "Facilities",          category: "FACILITY",            dept: "Facilities" },
  { label: "HR",                  category: "EMPLOYEE",            dept: "Human Resources" },
  { label: "Quality Control",     category: "EQUIPMENT_BREAKDOWN", dept: "Quality Control" },
  { label: "Other",               category: "GENERAL",             dept: null },
]

const LOCATION_TYPES = ["Plant", "Warehouse", "Office", "Retail", "Service Facility"]

const CHAPTER_SEQUENCE: ChapterId[] = [
  "org_info", "issue_types", "locations", "employee_types", "team_invites", "routing", "review",
]

const CHAPTER_STAGE: Partial<Record<ChapterId, number>> = {
  org_info: 1, issue_types: 2, locations: 3,
  employee_types: 4, team_invites: 5, routing: 6, review: 6,
}

const inputCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
const selectCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

// ─── Utils ────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }
function storageKey(userId: string) { return `relay_onboarding_${userId}` }
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function defaultData(orgName: string): WizardData {
  return {
    companyName: orgName, industry: "", industryOther: "", companySize: "",
    numberOfLocations: "", packagePlan: "", issueTypes: [], issueTypeOther: "",
    locations: [{ id: uid(), name: "", address: "", locationType: "" }],
    employeeTypeDefs: [], team: [], routing: {},
  }
}

function getSelectedCategories(data: WizardData): IssueTypeOption[] {
  const seen = new Set<string>()
  const result: IssueTypeOption[] = []
  for (const label of data.issueTypes) {
    const type = ISSUE_TYPES.find(t => t.label === label)
    if (type && !seen.has(type.category)) { seen.add(type.category); result.push(type) }
  }
  return result
}

function isChapterComplete(chapter: ChapterId, data: WizardData): boolean {
  switch (chapter) {
    case "org_info": return !!data.industry
    case "issue_types": return data.issueTypes.length > 0
    case "locations": return data.locations.some(l => l.name.trim() !== "")
    case "employee_types": return data.employeeTypeDefs.length > 0
    default: return false
  }
}

function getTransitionMessage(chapter: ChapterId, data: WizardData): string {
  const name = data.companyName || "your organization"
  switch (chapter) {
    case "org_info": return `Let's start with some basic information about ${name}.`
    case "issue_types": return "What types of issues and requests does your team handle?"
    case "locations": return `Where does ${name} operate? Add your locations below.`
    case "employee_types": return "Let's define the roles in your organization."
    case "team_invites": return "Who should be invited to Relay? You can skip this and add people later from Settings."
    case "routing": return "How should issues be routed to your team? You can skip this and configure later."
    case "review": return "Almost done! Review your configuration before finishing setup."
    default: return "Let's continue."
  }
}

function getChapterTitle(chapter: ChapterId): string {
  const titles: Record<ChapterId, string> = {
    start: "Getting started", org_info: "Organization", issue_types: "Issue types",
    locations: "Locations", employee_types: "Employee types", team_invites: "Team invites",
    routing: "Routing", review: "Review",
  }
  return titles[chapter]
}

function getChapterSummary(chapter: ChapterId, data: WizardData): string {
  switch (chapter) {
    case "start": return "Setup approach selected"
    case "org_info": {
      const parts = [data.companyName || "Organization"]
      if (data.industry) parts.push(data.industry)
      if (data.companySize) parts.push(`${data.companySize} employees`)
      if (data.numberOfLocations) parts.push(`${data.numberOfLocations} location${Number(data.numberOfLocations) !== 1 ? "s" : ""}`)
      return parts.join(" · ")
    }
    case "issue_types": return data.issueTypes.length ? data.issueTypes.join(", ") : "None selected"
    case "locations": {
      const named = data.locations.filter(l => l.name.trim())
      return named.length ? named.map(l => l.name).join(", ") : "No locations added"
    }
    case "employee_types": return data.employeeTypeDefs.length ? data.employeeTypeDefs.map(d => d.name).join(", ") : "None defined"
    case "team_invites": {
      const valid = data.team.filter(m => m.email.trim())
      return valid.length ? `${valid.length} invitation${valid.length !== 1 ? "s" : ""} pending` : "Skipped"
    }
    case "routing": {
      const ruled = Object.values(data.routing).filter(v => v).length
      return ruled ? `${ruled} rule${ruled !== 1 ? "s" : ""} configured` : "Skipped"
    }
    case "review": return "Setup complete"
    default: return ""
  }
}

function getNextChapter(current: ChapterId): ChapterId | null {
  const idx = CHAPTER_SEQUENCE.indexOf(current)
  return idx < 0 || idx >= CHAPTER_SEQUENCE.length - 1 ? null : CHAPTER_SEQUENCE[idx + 1]
}

function hasAnyData(data: WizardData): boolean {
  return !!data.industry || data.issueTypes.length > 0 || data.locations.some(l => l.name.trim() !== "")
}

function buildRestoredItems(data: WizardData, orgName: string): { items: ConvItem[]; activeChapter: ChapterId } {
  const items: ConvItem[] = []
  items.push({ kind: "ai_msg", id: "welcome_back", text: `Welcome back! Let's continue setting up ${data.companyName || orgName}.` })
  for (const chapter of CHAPTER_SEQUENCE) {
    if (chapter === "review") break
    if (isChapterComplete(chapter, data)) {
      items.push({ kind: "chapter_card", id: `c_${chapter}`, chapter, collapsed: true })
    } else {
      if (items.length > 1) {
        items.push({ kind: "ai_msg", id: `t_${chapter}`, text: getTransitionMessage(chapter, data) })
      }
      items.push({ kind: "chapter_card", id: `c_${chapter}_active`, chapter, collapsed: false })
      return { items, activeChapter: chapter }
    }
  }
  items.push({ kind: "ai_msg", id: "t_review", text: getTransitionMessage("review", data) })
  items.push({ kind: "chapter_card", id: "c_review", chapter: "review", collapsed: false })
  return { items, activeChapter: "review" }
}

// ─── Conversation reducer ─────────────────────────────────────────────────────

function convReducer(state: ConvItem[], action: ConvAction): ConvItem[] {
  switch (action.type) {
    case "add":
      return [...state.filter(i => i.kind !== "typing"), action.item]
    case "typing_on":
      return state.some(i => i.kind === "typing") ? state : [...state, { kind: "typing", id: "typing_" + Date.now() }]
    case "collapse":
      return state.map(i => i.kind === "chapter_card" && i.chapter === action.chapter ? { ...i, collapsed: true } : i)
    case "expand":
      return state.map(i => i.kind === "chapter_card" && i.chapter === action.chapter ? { ...i, collapsed: false } : i)
    case "restore":
      return action.items
    default:
      return state
  }
}

function initialItems(orgName: string): ConvItem[] {
  return [
    { kind: "ai_msg", id: "welcome", text: `Hi! I'll help get ${orgName || "your organization"} set up on Relay. How would you like to get started?` },
    { kind: "chapter_card", id: "c_start", chapter: "start", collapsed: false },
  ]
}

// ─── AI helpers ───────────────────────────────────────────────────────────────

function buildWizardContext(stage: number, data: WizardData): Record<string, unknown> {
  const ctx: Record<string, unknown> = { industry: data.industry, companySize: data.companySize, numberOfLocations: data.numberOfLocations }
  if (stage >= 2) ctx.issueTypes = data.issueTypes
  if (stage >= 4) ctx.employeeTypeDefs = data.employeeTypeDefs.map(d => ({ name: d.name, baseRole: d.baseRole, presetKey: d.presetKey }))
  if (stage >= 5) ctx.teamMembers = data.team.map(m => ({ name: m.name, role: m.role, email: m.email }))
  if (stage >= 6) ctx.routing = data.routing
  return ctx
}

function applyWizardUpdate(data: WizardData, update: WizardUpdatePayload): WizardData {
  const updated = { ...data }
  if (update.orgProfile) {
    if (update.orgProfile.companyName) updated.companyName = update.orgProfile.companyName
    if (update.orgProfile.industry) updated.industry = update.orgProfile.industry
    if (update.orgProfile.companySize) updated.companySize = update.orgProfile.companySize
    if (update.orgProfile.numberOfLocations) updated.numberOfLocations = update.orgProfile.numberOfLocations
  }
  if (update.issueTypes) updated.issueTypes = update.issueTypes
  if (update.employeeTypeDefs) {
    const existing = new Set(updated.employeeTypeDefs.map(d => d.presetKey).filter(Boolean))
    const toAdd = update.employeeTypeDefs
      .filter(d => !d.presetKey || !existing.has(d.presetKey))
      .map(d => ({ ...d, pageAccess: d.pageAccess as PageKey[], actions: d.actions as ActionKey[] }))
    updated.employeeTypeDefs = [...updated.employeeTypeDefs, ...toAdd]
  }
  if (update.teamMembers) {
    const existingEmails = new Set(updated.team.map(m => m.email.toLowerCase()))
    const toAdd = update.teamMembers.filter(m => !existingEmails.has(m.email.toLowerCase()))
    updated.team = [...updated.team, ...toAdd]
  }
  if (update.routing) updated.routing = { ...updated.routing, ...update.routing }
  return updated
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

function AiMessage({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className="flex gap-3 max-w-[88%]">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
        <Zap className="w-3.5 h-3.5 text-white" />
      </div>
      <div className={`px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed ${
        error ? "bg-red-50 text-red-700 border border-red-200" : "bg-white border border-gray-200 text-gray-800 shadow-sm"
      }`}>
        {text}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 max-w-[88%]">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
        <Zap className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
        {[0, 150, 300].map(d => (
          <div key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  )
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] px-4 py-2.5 bg-blue-600 text-white rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
        {text}
      </div>
    </div>
  )
}

function ChapterSummaryRow({ chapter, data, onEdit }: { chapter: ChapterId; data: WizardData; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
          <Check className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-green-800 uppercase tracking-wide shrink-0">{getChapterTitle(chapter)}</span>
        <span className="text-sm text-gray-600 truncate">{getChapterSummary(chapter, data)}</span>
      </div>
      <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0 ml-3">Edit</button>
    </div>
  )
}

// ─── Chapter cards ────────────────────────────────────────────────────────────

function StartCard({ onGuided, onDescribe }: {
  onGuided: () => void
  onDescribe: (text: string) => void
}) {
  const [approach, setApproach] = useState<"guided" | "describe">("guided")
  const [description, setDescription] = useState("")

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-3 mb-4">
        {(["guided", "describe"] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setApproach(a)}
            className={`p-3.5 border-2 rounded-xl text-left text-sm transition-colors ${
              approach === a ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="font-semibold text-gray-900 mb-0.5">{a === "guided" ? "🎯 Step by step" : "💬 Describe it"}</div>
            <div className="text-xs text-gray-500">{a === "guided" ? "I'll guide you through each section" : "Tell me about your organization"}</div>
          </button>
        ))}
      </div>
      {approach === "describe" && (
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. We operate 3 manufacturing plants with 150 employees across maintenance, production, and quality departments. HR and finance are centralized at HQ."
          rows={4}
          className="w-full mb-4 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      )}
      <button
        type="button"
        onClick={() => approach === "guided" ? onGuided() : onDescribe(description)}
        disabled={approach === "describe" && !description.trim()}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
      >
        Get Started <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function OrgInfoCard({ data, onComplete }: {
  data: WizardData
  onComplete: (updates: Partial<WizardData>) => void
}) {
  const [name, setName] = useState(data.companyName)
  const [industry, setIndustry] = useState(data.industry)
  const [industryOther, setIndustryOther] = useState(data.industryOther || "")
  const [employees, setEmployees] = useState(data.companySize)
  const [locations, setLocations] = useState(data.numberOfLocations)
  const [err, setErr] = useState("")

  const isOther = industry === "Other" || (!!industry && !INDUSTRY_LABELS.includes(industry))

  function handleSubmit() {
    if (!industry || (isOther && !industryOther.trim())) { setErr("Please select an industry."); return }
    setErr("")
    onComplete({
      companyName: name.trim() || data.companyName,
      industry: isOther ? industryOther.trim() : industry,
      industryOther: isOther ? industryOther.trim() : "",
      companySize: employees,
      numberOfLocations: locations,
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
          <Building2 className="w-4 h-4 text-blue-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Your organization</h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Acme Industries" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
          <select value={isOther ? "Other" : industry} onChange={e => { setIndustry(e.target.value); if (e.target.value !== "Other") setIndustryOther("") }} className={selectCls}>
            <option value="">Select industry…</option>
            {INDUSTRY_LABELS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          {isOther && (
            <input type="text" value={industryOther} onChange={e => setIndustryOther(e.target.value)} placeholder="Describe your industry" className={`${inputCls} mt-2`} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Total employees</label>
            <input type="number" min={1} value={employees} onChange={e => setEmployees(e.target.value)} className={inputCls} placeholder="e.g. 50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Locations</label>
            <input type="number" min={1} value={locations} onChange={e => setLocations(e.target.value)} className={inputCls} placeholder="e.g. 3" />
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" onClick={handleSubmit} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function IssueTypesCard({ data, onComplete }: {
  data: WizardData
  onComplete: (updates: Partial<WizardData>) => void
}) {
  const [selected, setSelected] = useState<string[]>(data.issueTypes)
  const [other, setOther] = useState(data.issueTypeOther || "")
  const [err, setErr] = useState("")

  function toggle(label: string) {
    setSelected(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
  }

  function handleSubmit() {
    if (selected.length === 0) { setErr("Please select at least one issue type."); return }
    setErr("")
    onComplete({ issueTypes: selected, issueTypeOther: other })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-orange-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Issue types</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Select all the categories of issues your team handles.</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {ISSUE_TYPES.map(type => {
          const on = selected.includes(type.label)
          return (
            <button key={type.label} type="button" onClick={() => toggle(type.label)}
              className={`flex items-center gap-2.5 px-3 py-2.5 border-2 rounded-xl text-sm text-left transition-colors ${
                on ? "border-blue-500 bg-blue-50 text-blue-900" : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                {on && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              {type.label}
            </button>
          )
        })}
      </div>
      {selected.includes("Other") && (
        <input type="text" value={other} onChange={e => setOther(e.target.value)} placeholder="Describe the other issue type" className={`${inputCls} mb-4`} />
      )}
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <button type="button" onClick={handleSubmit} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
        Continue ({selected.length} selected) <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function LocationsCard({ data, onComplete, onSkip }: {
  data: WizardData
  onComplete: (updates: Partial<WizardData>) => void
  onSkip: () => void
}) {
  const count = Math.max(1, Math.min(Number(data.numberOfLocations) || 1, 10))
  const [locs, setLocs] = useState<LocationEntry[]>(() => {
    const hasNamed = data.locations.some(l => l.name.trim())
    if (hasNamed) return data.locations
    const rows: LocationEntry[] = []
    for (let i = 0; i < count; i++) rows.push({ id: uid(), name: "", address: "", locationType: "" })
    return rows
  })

  function update(idx: number, field: keyof LocationEntry, val: string) {
    setLocs(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
          <MapPin className="w-4 h-4 text-green-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Locations</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Name your locations. Type is optional.</p>
      <div className="space-y-2.5 mb-4">
        {locs.map((loc, idx) => (
          <div key={loc.id} className="grid grid-cols-[1fr,auto,auto] gap-2 items-center">
            <input type="text" value={loc.name} onChange={e => update(idx, "name", e.target.value)} placeholder={`Location ${idx + 1}`} className={inputCls} />
            <select value={loc.locationType} onChange={e => update(idx, "locationType", e.target.value)} className="px-2.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Type…</option>
              {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" onClick={() => setLocs(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)} disabled={locs.length <= 1} className="p-2.5 text-gray-400 hover:text-red-500 disabled:opacity-30">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setLocs(prev => [...prev, { id: uid(), name: "", address: "", locationType: "" }])} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mb-5">
        <Plus className="w-4 h-4" /> Add location
      </button>
      <div className="flex gap-3">
        <button type="button" onClick={onSkip} className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium">Skip for now</button>
        <button type="button" onClick={() => onComplete({ locations: locs })} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function EmployeeTypesCard({ data, onComplete, onSkip }: {
  data: WizardData
  onComplete: (updates: Partial<WizardData>) => void
  onSkip: () => void
}) {
  const [selected, setSelected] = useState<string[]>(
    data.employeeTypeDefs.map(d => d.presetKey).filter(Boolean) as string[]
  )

  function handleComplete() {
    const defs: EmployeeTypeDefEntry[] = selected.map(key => {
      const preset = EMPLOYEE_TYPE_PRESETS.find(p => p.key === key)!
      return { id: uid(), name: preset.name, baseRole: preset.baseRole, pageAccess: preset.pageAccess, actions: preset.actions, presetKey: preset.key, canInvite: preset.canInvite, canChangeEmail: preset.canChangeEmail }
    })
    onComplete({ employeeTypeDefs: defs })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-purple-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Employee types</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Select the roles in your organization. You can customize permissions later.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
        {EMPLOYEE_TYPE_PRESETS.map(preset => {
          const on = selected.includes(preset.key)
          return (
            <button key={preset.key} type="button" onClick={() => setSelected(prev => prev.includes(preset.key) ? prev.filter(k => k !== preset.key) : [...prev, preset.key])}
              className={`flex items-start gap-3 p-3 border-2 rounded-xl text-left text-sm transition-colors ${on ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                {on && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <div>
                <div className="font-medium text-gray-900">{preset.name}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{preset.description}</div>
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onSkip} className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium">Skip for now</button>
        <button type="button" onClick={handleComplete} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          Continue ({selected.length} selected) <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

type ImportPreviewRow = {
  rowNum: number
  name: string
  email: string
  role: string
  locationName: string | null
  departmentName: string | null
  warnings: string[]
  status: "invite" | "skip"
}

function TeamInvitesCard({ data, onComplete, onSkip }: {
  data: WizardData
  onComplete: (updates: Partial<WizardData>) => void
  onSkip: () => void
}) {
  const [members, setMembers] = useState<TeamEntry[]>(
    data.team.length > 0 ? data.team : [{ id: uid(), name: "", email: "", title: "", role: "MANAGER", employeeTypeId: "" }]
  )
  const [showImport, setShowImport]       = useState(false)
  const [importRows, setImportRows]       = useState<ImportPreviewRow[]>([])
  const [importErrors, setImportErrors]   = useState<string[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "HR", "EMPLOYEE"]

  function update(idx: number, field: keyof TeamEntry, val: string) {
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m))
  }

  async function handleFileSelect(file: File) {
    setImportLoading(true)
    setImportRows([])
    setImportErrors([])
    try {
      const text = await file.text()
      const res = await fetch("/api/onboarding/import/employees", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      })
      const json = await res.json() as { rows?: ImportPreviewRow[]; errors?: string[] }
      setImportRows(json.rows ?? [])
      setImportErrors(json.errors ?? [])
    } catch {
      setImportErrors(["Failed to process file. Please check the format and try again."])
    } finally {
      setImportLoading(false)
    }
  }

  async function confirmImport() {
    setImportLoading(true)
    try {
      const res = await fetch("/api/onboarding/import/employees?confirm=true", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        // Re-use the last preview result to get the file; re-send is simpler than caching
        // We re-trigger from the preview rows since they already contain validated data
        body: importRows
          .filter(r => r.status === "invite")
          .map(r => `${r.name},${r.email},${r.role},,${r.locationName ?? ""},${r.departmentName ?? ""}`)
          .join("\n"),
      })
      const json = await res.json() as { invited?: number; errors?: string[] }
      setImportErrors(json.errors ?? [])
      setImportDone(true)
    } catch {
      setImportErrors(["Import failed. Please try again."])
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-pink-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Team invites</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Add team members to invite after setup is complete.</p>

      {!showImport ? (
        <>
          <div className="space-y-2 mb-3">
            {members.map((m, idx) => (
              <div key={m.id} className="grid grid-cols-[1fr,1fr,auto,auto] gap-2 items-center">
                <input type="text" value={m.name} onChange={e => update(idx, "name", e.target.value)} placeholder="Name" className={inputCls} />
                <input type="email" value={m.email} onChange={e => update(idx, "email", e.target.value)} placeholder="Email" className={inputCls} />
                <select value={m.role} onChange={e => update(idx, "role", e.target.value)} className="px-2.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="button" onClick={() => setMembers(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)} disabled={members.length <= 1} className="p-2.5 text-gray-400 hover:text-red-500 disabled:opacity-30">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mb-5">
            <button type="button" onClick={() => setMembers(prev => [...prev, { id: uid(), name: "", email: "", title: "", role: "MANAGER", employeeTypeId: "" }])} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
              <Plus className="w-4 h-4" /> Add person
            </button>
            <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </button>
          </div>
        </>
      ) : (
        <div className="mb-5">
          {importDone ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-3">
              <Check className="w-4 h-4 shrink-0" /> Invitations sent — team members will receive an email to accept.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Import from CSV</span>
                <a href="/api/onboarding/import/employees" className="text-xs text-blue-600 hover:text-blue-700 underline">Download template</a>
              </div>
              {importRows.length === 0 && (
                <>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importLoading} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-60">
                    {importLoading ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <Upload className="w-5 h-5 text-gray-400" />}
                    <span className="text-sm text-gray-500">{importLoading ? "Processing…" : "Click to upload CSV"}</span>
                  </button>
                </>
              )}
              {importRows.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Name</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Email</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Role</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importRows.map(row => (
                        <tr key={row.rowNum} className={row.status === "skip" ? "opacity-50" : ""}>
                          <td className="px-3 py-2 text-gray-800">{row.name}</td>
                          <td className="px-3 py-2 text-gray-600">{row.email}</td>
                          <td className="px-3 py-2 text-gray-600">{row.role}</td>
                          <td className="px-3 py-2">
                            {row.status === "invite"
                              ? <span className="text-green-700 font-medium">Will invite</span>
                              : <span className="text-gray-400">Already exists</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {importErrors.length > 0 && (
                <div className="mb-3 space-y-1">
                  {importErrors.slice(0, 5).map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {e}
                    </div>
                  ))}
                  {importErrors.length > 5 && <p className="text-xs text-gray-500 pl-3">+{importErrors.length - 5} more warnings</p>}
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowImport(false); setImportRows([]); setImportErrors([]); setImportDone(false) }} className="text-sm text-gray-500 hover:text-gray-700">
              Back to manual
            </button>
            {importRows.length > 0 && !importDone && (
              <button type="button" onClick={confirmImport} disabled={importLoading || importRows.filter(r => r.status === "invite").length === 0} className="ml-auto flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-60">
                {importLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send {importRows.filter(r => r.status === "invite").length} invitation{importRows.filter(r => r.status === "invite").length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onSkip} className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium">Skip for now</button>
        <button type="button" onClick={() => onComplete({ team: members.filter(m => m.email.trim()) })} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function RoutingCard({ data, onComplete, onSkip }: {
  data: WizardData
  onComplete: (updates: Partial<WizardData>) => void
  onSkip: () => void
}) {
  const categories = getSelectedCategories(data)
  const [routing, setRouting] = useState<Record<string, string>>({ ...data.routing })
  const ROLE_OPTIONS = [
    { value: "", label: "— Unassigned —" },
    { value: "role:MANAGER", label: "Manager" },
    { value: "role:SUPERVISOR", label: "Supervisor" },
    { value: "role:ADMIN", label: "Admin" },
    { value: "role:HR", label: "HR" },
  ]

  if (categories.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-gray-500 mb-3">No issue types selected — routing setup requires at least one issue type.</p>
        <button type="button" onClick={onSkip} className="text-sm text-blue-600 hover:text-blue-700">Continue</button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Network className="w-4 h-4 text-indigo-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Issue routing</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Assign each issue type to a role. You can refine this later in Settings.</p>
      <div className="space-y-2.5 mb-5">
        {categories.map(cat => (
          <div key={cat.category} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 w-36 shrink-0">{cat.label}</span>
            <select value={routing[cat.category] ?? ""} onChange={e => setRouting(r => ({ ...r, [cat.category]: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onSkip} className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium">Skip for now</button>
        <button type="button" onClick={() => onComplete({ routing })} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ReviewCard({ data, onComplete, loading, error }: {
  data: WizardData
  onComplete: () => void
  loading: boolean
  error: string
}) {
  const sections = [
    { label: "Organization", value: [data.companyName, data.industry, data.companySize && `${data.companySize} employees`].filter(Boolean).join(" · ") },
    { label: "Issue types", value: data.issueTypes.length ? data.issueTypes.join(", ") : "—", warn: data.issueTypes.length === 0 },
    { label: "Locations", value: data.locations.filter(l => l.name.trim()).map(l => l.name).join(", ") || "—" },
    { label: "Employee types", value: data.employeeTypeDefs.length ? data.employeeTypeDefs.map(d => d.name).join(", ") : "—" },
    { label: "Team invites", value: data.team.filter(m => m.email.trim()).length ? `${data.team.filter(m => m.email.trim()).length} pending` : "None" },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
          <Rocket className="w-4 h-4 text-green-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Review & finish</h3>
      </div>
      <div className="space-y-3 mb-5">
        {sections.map(s => (
          <div key={s.label} className="flex gap-3">
            <span className={`text-xs font-semibold uppercase tracking-wide w-28 shrink-0 mt-0.5 ${(s as { warn?: boolean }).warn ? "text-amber-600" : "text-gray-400"}`}>{s.label}</span>
            <span className={`text-sm ${(s as { warn?: boolean }).warn ? "text-amber-700" : "text-gray-700"}`}>{s.value}</span>
          </div>
        ))}
      </div>
      {data.issueTypes.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Please go back and select at least one issue type.</p>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <button type="button" onClick={onComplete} disabled={loading || data.issueTypes.length === 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        {loading ? "Setting up…" : "Complete Setup"}
      </button>
    </div>
  )
}

function CompletionCard({ orgName, userId, router }: {
  orgName: string
  userId: string
  router: ReturnType<typeof useRouter>
}) {
  const [starting, setStarting] = useState(false)
  const [err, setErr] = useState("")

  async function startTrial() {
    setStarting(true)
    const r = await fetch("/api/subscription/start-trial", { method: "POST" })
    if (!r.ok) { setErr("Could not start trial. Please try again."); setStarting(false); return }
    localStorage.removeItem(storageKey(userId))
    router.push("/dashboard")
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <PartyPopper className="w-6 h-6 text-green-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">{orgName} is ready!</h3>
      <p className="text-sm text-gray-500 mb-6">Your workspace is configured. Choose how to get started.</p>
      {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
      <div className="space-y-3">
        <button type="button" onClick={startTrial} disabled={starting}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          {starting ? "Starting…" : "Start 30-Day Free Trial"}
        </button>
        <button type="button" onClick={() => router.push("/subscribe")}
          className="w-full py-3.5 border-2 border-gray-200 hover:border-gray-300 text-gray-800 rounded-xl font-semibold"
        >
          Subscribe Now
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-4">No credit card required for the free trial.</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConversationalOnboarding({
  orgName,
  userId,
  initialIndustry,
  initialPlan,
  onSwitchToWizard,
}: {
  orgName: string
  userId: string
  initialIndustry?: string
  initialPlan?: string
  onSwitchToWizard: () => void
}) {
  const router = useRouter()
  const [data, setData] = useState<WizardData>(() => defaultData(orgName))
  const [items, dispatch] = useReducer(convReducer, null, () => initialItems(orgName))
  const [activeChapter, setActiveChapter] = useState<ChapterId>("start")
  const [composerInput, setComposerInput] = useState("")
  const [composerLoading, setComposerLoading] = useState(false)
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState("")
  const [setupDone, setSetupDone] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const { session: serverSession, updateSession } = useOnboardingSession()
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)

  // Hydrate from localStorage (shared key with SetupWizard)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId))
      if (raw) {
        const saved = JSON.parse(raw) as Partial<WizardData>
        const restored: WizardData = { ...defaultData(orgName), ...saved }
        if (initialIndustry && !restored.industry) restored.industry = initialIndustry
        if (initialPlan && !restored.packagePlan) restored.packagePlan = initialPlan
        setData(restored)
        if (hasAnyData(restored)) {
          const { items: ri, activeChapter: ac } = buildRestoredItems(restored, orgName)
          dispatch({ type: "restore", items: ri })
          setActiveChapter(ac)
        }
      } else {
        if (initialIndustry) setData(d => ({ ...d, industry: initialIndustry }))
        if (initialPlan) setData(d => ({ ...d, packagePlan: initialPlan }))
      }
    } catch { /* ignore */ }
    setHydrated(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Auto-scroll when items grow
  useEffect(() => {
    if (items.length > prevLen.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
    prevLen.current = items.length
  }, [items])

  // Persist to localStorage on data/chapter changes
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(storageKey(userId), JSON.stringify(data)) } catch { /* ignore */ }
    updateSession({ currentStage: CHAPTER_SEQUENCE.indexOf(activeChapter) + 1 }).catch(() => { /* ignore */ })
  }, [data, activeChapter, hydrated, userId, updateSession])

  async function advanceChapter(from: ChapterId, updatedData: WizardData) {
    dispatch({ type: "collapse", chapter: from })
    const next = getNextChapter(from)
    if (!next) return
    dispatch({ type: "typing_on" })
    await sleep(600)
    dispatch({ type: "add", item: { kind: "ai_msg", id: `t_${next}_${Date.now()}`, text: getTransitionMessage(next, updatedData) } })
    await sleep(200)
    dispatch({ type: "add", item: { kind: "chapter_card", id: `c_${next}_${Date.now()}`, chapter: next, collapsed: false } })
    setActiveChapter(next)
  }

  function onChapterDone(chapter: ChapterId, updates: Partial<WizardData>) {
    const updated = { ...data, ...updates }
    setData(updated)
    advanceChapter(chapter, updated)
  }

  async function sendMessage(text: string) {
    const msg = text.trim()
    if (!msg || composerLoading) return
    setComposerInput("")
    dispatch({ type: "add", item: { kind: "user_msg", id: `u_${Date.now()}`, text: msg } })
    setComposerLoading(true)
    dispatch({ type: "typing_on" })

    const stage = CHAPTER_STAGE[activeChapter] ?? 1
    const wizardCtx = buildWizardContext(stage, data)

    try {
      const res = await fetch("/api/ai/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, history: aiHistory, sessionId: serverSession?.id, stage, wizardContext: wizardCtx }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as Record<string, unknown>
        const errMsg = (typeof j.error === "string" ? j.error : null) ?? "An error occurred."
        dispatch({ type: "add", item: { kind: "ai_msg", id: `e_${Date.now()}`, text: errMsg, error: true } })
        return
      }
      const json = await res.json() as {
        type?: string; question?: string; update?: unknown; summary?: string
        history?: Array<{ role: "user" | "assistant"; content: string }>
      }
      if (json.history) setAiHistory(json.history)

      if (json.type === "wizard_update" && json.update) {
        const update = json.update as WizardUpdatePayload
        const updated = applyWizardUpdate(data, update)
        setData(updated)
        dispatch({ type: "add", item: { kind: "ai_msg", id: `r_${Date.now()}`, text: `Got it${json.summary ? ` — ${json.summary}` : ""}. I've updated the configuration.` } })
        if (update.orgProfile) dispatch({ type: "expand", chapter: "org_info" })
        if (update.issueTypes) dispatch({ type: "expand", chapter: "issue_types" })
        if (update.employeeTypeDefs) dispatch({ type: "expand", chapter: "employee_types" })
        if (update.teamMembers) dispatch({ type: "expand", chapter: "team_invites" })
        if (update.routing) dispatch({ type: "expand", chapter: "routing" })
      } else if (json.type === "clarification" && json.question) {
        dispatch({ type: "add", item: { kind: "ai_msg", id: `r_${Date.now()}`, text: json.question } })
      } else {
        dispatch({ type: "add", item: { kind: "ai_msg", id: `r_${Date.now()}`, text: "Noted! Anything else I can help with?" } })
      }
    } catch {
      dispatch({ type: "add", item: { kind: "ai_msg", id: `e_${Date.now()}`, text: "Network error. Please try again.", error: true } })
    } finally {
      setComposerLoading(false)
    }
  }

  async function finish() {
    setFinishing(true)
    setFinishError("")
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as Record<string, unknown>
        setFinishError((typeof j.error === "string" ? j.error : null) ?? "Something went wrong. Please try again.")
        setFinishing(false)
        return
      }
      const json = await res.json().catch(() => ({})) as { emailFailures?: string[] }
      const emailFailures = json.emailFailures ?? []
      dispatch({ type: "collapse", chapter: "review" })
      dispatch({ type: "add", item: { kind: "ai_msg", id: "complete_msg", text: `🎉 ${data.companyName || orgName} is set up! Choose how you'd like to get started.` } })
      if (emailFailures.length > 0) {
        dispatch({
          type: "add",
          item: {
            kind: "ai_msg",
            id: "email_fail_msg",
            text: `${emailFailures.length} invitation${emailFailures.length > 1 ? "s" : ""} couldn't be delivered to: ${emailFailures.join(", ")}. You can resend them from Settings → Team after setup.`,
            error: true,
          },
        })
      }
      dispatch({ type: "add", item: { kind: "chapter_card", id: "c_complete", chapter: "review", collapsed: false } })
      setSetupDone(true)
    } catch {
      setFinishError("Network error. Please try again.")
    } finally {
      setFinishing(false)
    }
  }

  function renderItem(item: ConvItem): React.ReactNode {
    switch (item.kind) {
      case "ai_msg": return <AiMessage key={item.id} text={item.text} error={item.error} />
      case "typing": return <TypingIndicator key={item.id} />
      case "user_msg": return <UserMessage key={item.id} text={item.text} />
      case "chapter_card": return renderChapterCard(item)
    }
  }

  function renderChapterCard(item: ConvItem & { kind: "chapter_card" }): React.ReactNode {
    if (setupDone && item.chapter === "review" && !item.collapsed) {
      return <CompletionCard key={item.id} orgName={data.companyName || orgName} userId={userId} router={router} />
    }
    if (item.collapsed) {
      return <ChapterSummaryRow key={item.id} chapter={item.chapter} data={data} onEdit={() => dispatch({ type: "expand", chapter: item.chapter })} />
    }
    switch (item.chapter) {
      case "start":
        return (
          <StartCard key={item.id}
            onGuided={() => {
              dispatch({ type: "collapse", chapter: "start" })
              setTimeout(() => {
                dispatch({ type: "add", item: { kind: "ai_msg", id: `post_start_${Date.now()}`, text: getTransitionMessage("org_info", data) } })
                dispatch({ type: "add", item: { kind: "chapter_card", id: `c_org_info_${Date.now()}`, chapter: "org_info", collapsed: false } })
                setActiveChapter("org_info")
              }, 50)
            }}
            onDescribe={(text) => {
              dispatch({ type: "collapse", chapter: "start" })
              setTimeout(() => {
                dispatch({ type: "add", item: { kind: "ai_msg", id: `post_start_${Date.now()}`, text: getTransitionMessage("org_info", data) } })
                dispatch({ type: "add", item: { kind: "chapter_card", id: `c_org_info_${Date.now()}`, chapter: "org_info", collapsed: false } })
                setActiveChapter("org_info")
              }, 50)
              sendMessage(text)
            }}
          />
        )
      case "org_info":
        return <OrgInfoCard key={item.id} data={data} onComplete={updates => onChapterDone("org_info", updates)} />
      case "issue_types":
        return <IssueTypesCard key={item.id} data={data} onComplete={updates => onChapterDone("issue_types", updates)} />
      case "locations":
        return <LocationsCard key={item.id} data={data} onComplete={updates => onChapterDone("locations", updates)} onSkip={() => advanceChapter("locations", data)} />
      case "employee_types":
        return <EmployeeTypesCard key={item.id} data={data} onComplete={updates => onChapterDone("employee_types", updates)} onSkip={() => advanceChapter("employee_types", data)} />
      case "team_invites":
        return <TeamInvitesCard key={item.id} data={data} onComplete={updates => onChapterDone("team_invites", updates)} onSkip={() => advanceChapter("team_invites", data)} />
      case "routing":
        return <RoutingCard key={item.id} data={data} onComplete={updates => onChapterDone("routing", updates)} onSkip={() => advanceChapter("routing", data)} />
      case "review":
        return <ReviewCard key={item.id} data={data} onComplete={finish} loading={finishing} error={finishError} />
    }
  }

  // `items` is a discriminated union array — React.ReactNode[] needs explicit cast
  const renderedItems = items.map(renderItem)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <RelayWordmark height={28} />
        <button type="button" onClick={onSwitchToWizard} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Settings className="w-4 h-4" /> Manual setup
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {renderedItems}
          <div ref={bottomRef} />
        </div>
      </div>

      {!setupDone && (
        <div className="bg-white border-t border-gray-200 shrink-0">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={composerInput}
                onChange={e => setComposerInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(composerInput) } }}
                placeholder="Ask a question or describe your organization…"
                disabled={composerLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <button type="button" onClick={() => sendMessage(composerInput)} disabled={!composerInput.trim() || composerLoading}
                className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {composerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">Fill out the form above, or type naturally here — AI assistance powered by Claude</p>
          </div>
        </div>
      )}
    </div>
  )
}
