"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Check, ChevronRight, ChevronLeft, Building2, Zap,
  MapPin, Users, Briefcase, Loader2, Plus, Trash2,
  Rocket, Settings, Network, CheckSquare, Square,
  Mail, PartyPopper, UserPlus,
} from "lucide-react"
import { RelayWordmark } from "@/components/logo"
import { EMPLOYEE_TYPE_PRESETS, type EmployeeTypePreset } from "@/lib/employee-type-presets"
import { CONFIGURABLE_PAGES, CONFIGURABLE_ACTIONS, type PageKey, type ActionKey } from "@/lib/page-access"
import { INDUSTRY_LABELS, getTemplate } from "@/lib/industry-templates"

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_LABELS = ["Organization", "Operations", "Locations", "Team", "Workflow"]

const INDUSTRIES = INDUSTRY_LABELS


interface IssueTypeOption {
  label: string
  category: string
  dept: string | null
}

const ISSUE_TYPES: IssueTypeOption[] = [
  { label: "Maintenance",         category: "MAINTENANCE",       dept: "Maintenance" },
  { label: "Operations",          category: "GENERAL",           dept: "Operations" },
  { label: "Safety",              category: "SAFETY",            dept: "Safety" },
  { label: "Customer Complaints", category: "CUSTOMER_COMPLAINT",dept: "Customer Service" },
  { label: "Purchasing",          category: "SUPPLY_SHORTAGE",   dept: "Purchasing" },
  { label: "IT",                  category: "FACILITY",          dept: "Information Technology" },
  { label: "Facilities",          category: "FACILITY",          dept: "Facilities" },
  { label: "HR",                  category: "EMPLOYEE",          dept: "Human Resources" },
  { label: "Quality Control",     category: "EQUIPMENT_BREAKDOWN", dept: "Quality Control" },
  { label: "Other",               category: "GENERAL",           dept: null },
]

const LOCATION_TYPES = ["Plant", "Warehouse", "Office", "Retail", "Service Facility"]

const ROLE_COLORS: Record<string, string> = {
  ADMIN:      "bg-purple-100 text-purple-800",
  MANAGER:    "bg-blue-100 text-blue-800",
  SUPERVISOR: "bg-indigo-100 text-indigo-800",
  HR:         "bg-pink-100 text-pink-800",
  EMPLOYEE:   "bg-gray-100 text-gray-700",
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
  // Non-empty only when user selected Wash Essentials on /onboarding/packages.
  // Sent to api/onboarding to scope the trial productLine from day 1.
  packagePlan: string
  issueTypes: string[]
  issueTypeOther: string
  locations: LocationEntry[]
  employeeTypeDefs: EmployeeTypeDefEntry[]
  team: TeamEntry[]
  routing: Record<string, string>
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function defaultData(orgName: string): WizardData {
  return {
    companyName: orgName,
    industry: "",
    industryOther: "",
    companySize: "",
    numberOfLocations: "",
    packagePlan: "",
    issueTypes: [],
    issueTypeOther: "",
    locations: [{ id: uid(), name: "", address: "", locationType: "" }],
    employeeTypeDefs: [],
    team: [],
    routing: {},
  }
}

function storageKey(userId: string) {
  return `relay_onboarding_${userId}`
}

// ─── Field component ─────────────────────────────────────────────────────────

function Field({
  label,
  optional,
  children,
}: {
  label: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
const selectCls =
  "w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({
  data,
  set,
}: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
}) {
  const industryIsOther = data.industry === "Other"

  function handleIndustryChange(value: string) {
    set("industry", value)
    if (value !== "Other") {
      set("industryOther", "")
      const template = getTemplate(value)
      if (template.issueTypeLabels.length > 0) {
        set("issueTypes", template.issueTypeLabels)
      }
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tell us about your organization</h2>
          <p className="text-sm text-gray-500">We use this to tailor Relay to your operation.</p>
        </div>
      </div>

      <div className="space-y-5">
        <Field label="Company name">
          <input
            type="text"
            value={data.companyName}
            onChange={e => set("companyName", e.target.value)}
            placeholder="Acme Industries"
            className={inputCls}
          />
        </Field>

        <Field label="Industry">
          <select
            value={industryIsOther ? "Other" : data.industry}
            onChange={e => handleIndustryChange(e.target.value)}
            className={selectCls}
          >
            <option value="">Select industry…</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          {industryIsOther && (
            <input
              type="text"
              value={data.industryOther ?? ""}
              onChange={e => set("industryOther", e.target.value)}
              placeholder="Describe your industry"
              className={`${inputCls} mt-2`}
              autoFocus
            />
          )}
        </Field>

        <Field label="Approximate number of employees">
          <input
            type="number"
            min={1}
            value={data.companySize}
            onChange={e => set("companySize", e.target.value)}
            placeholder="e.g. 50"
            className={inputCls}
          />
        </Field>

        <Field label="Number of locations">
          <input
            type="number"
            min={1}
            value={data.numberOfLocations}
            onChange={e => set("numberOfLocations", e.target.value)}
            placeholder="e.g. 3"
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({
  data,
  set,
}: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
}) {
  const otherSelected = data.issueTypes.includes("Other")
  const industryLabel = data.industry && data.industry !== "Other" ? data.industry : null
  const template      = industryLabel ? getTemplate(industryLabel) : null
  const isAutoSuggested =
    template != null &&
    data.issueTypes.length > 0 &&
    template.issueTypeLabels.every(l => data.issueTypes.includes(l)) &&
    data.issueTypes.length === template.issueTypeLabels.length

  function toggle(label: string) {
    set(
      "issueTypes",
      data.issueTypes.includes(label)
        ? data.issueTypes.filter(t => t !== label)
        : [...data.issueTypes, label],
    )
    if (label === "Other" && data.issueTypes.includes("Other")) {
      set("issueTypeOther", "")
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">What types of issues do you want to track?</h2>
          <p className="text-sm text-gray-500">We&apos;ll set up the right categories and workflows for you.</p>
        </div>
      </div>

      {isAutoSuggested && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
          <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <span>
            Pre-selected based on your <strong>{data.industry}</strong> industry — adjust as needed.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ISSUE_TYPES.map(({ label }) => {
          const selected = data.issueTypes.includes(label)
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selected
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              {selected
                ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                : <Square className="w-4 h-4 text-gray-300 shrink-0" />}
              <span className={`text-sm font-medium ${selected ? "text-blue-700" : "text-gray-700"}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>

      {otherSelected && (
        <div className="mt-3">
          <input
            type="text"
            value={data.issueTypeOther}
            onChange={e => set("issueTypeOther", e.target.value)}
            placeholder="Describe your issue type"
            className={inputCls}
            autoFocus
          />
        </div>
      )}

      {data.issueTypes.length > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          {data.issueTypes.length} type{data.issueTypes.length !== 1 ? "s" : ""} selected — we&apos;ll create the matching departments and categories.
        </p>
      )}
    </div>
  )
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({
  data,
  set,
}: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
}) {
  function updateLoc(id: string, field: keyof Omit<LocationEntry, "id">, value: string) {
    set(
      "locations",
      data.locations.map(l => l.id === id ? { ...l, [field]: value } : l),
    )
  }

  function addLoc() {
    set("locations", [...data.locations, { id: uid(), name: "", address: "", locationType: "" }])
  }

  function removeLoc(id: string) {
    if (data.locations.length === 1) return
    set("locations", data.locations.filter(l => l.id !== id))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Add your locations</h2>
          <p className="text-sm text-gray-500">Where does your team operate? You can add more later.</p>
        </div>
      </div>

      <div className="space-y-4">
        {data.locations.map((loc, idx) => (
          <div key={loc.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Location {idx + 1}
              </span>
              {data.locations.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLoc(loc.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Location name">
                <input
                  type="text"
                  value={loc.name}
                  onChange={e => updateLoc(loc.id, "name", e.target.value)}
                  placeholder='e.g. "Main Plant"'
                  className={inputCls}
                />
              </Field>
              <Field label="Location type" optional>
                <select
                  value={loc.locationType}
                  onChange={e => updateLoc(loc.id, "locationType", e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select type…</option>
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Address" optional>
              <input
                type="text"
                value={loc.address}
                onChange={e => updateLoc(loc.id, "address", e.target.value)}
                placeholder="123 Industrial Blvd, Chicago, IL"
                className={inputCls}
              />
            </Field>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLoc}
        className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus className="w-4 h-4" />
        Add another location
      </button>
    </div>
  )
}

// ─── Step 4a: Define Employee Types ──────────────────────────────────────────

function Step4a({
  data,
  set,
}: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
}) {
  const [addingCustom, setAddingCustom] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customPages, setCustomPages] = useState<Set<PageKey>>(new Set())
  const [customActions, setCustomActions] = useState<Set<ActionKey>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function addPreset(preset: EmployeeTypePreset) {
    if (data.employeeTypeDefs.some(d => d.presetKey === preset.key)) return
    set("employeeTypeDefs", [...data.employeeTypeDefs, {
      id: uid(),
      name: preset.name,
      baseRole: preset.baseRole,
      pageAccess: preset.pageAccess as PageKey[],
      actions: (preset.actions ?? []) as ActionKey[],
      presetKey: preset.key,
      canInvite: preset.canInvite,
      canChangeEmail: preset.canChangeEmail,
    }])
  }

  function addCustomType() {
    if (!customName.trim()) return
    set("employeeTypeDefs", [...data.employeeTypeDefs, {
      id: uid(),
      name: customName.trim(),
      baseRole: "EMPLOYEE",
      pageAccess: Array.from(customPages) as PageKey[],
      actions: Array.from(customActions) as ActionKey[],
      presetKey: null,
      canInvite: false,
      canChangeEmail: true,
    }])
    setCustomName("")
    setCustomPages(new Set())
    setCustomActions(new Set())
    setAddingCustom(false)
  }

  function cancelCustom() {
    setAddingCustom(false)
    setCustomName("")
    setCustomPages(new Set())
    setCustomActions(new Set())
  }

  function removeDef(id: string) {
    set("employeeTypeDefs", data.employeeTypeDefs.filter(d => d.id !== id))
    set("team", data.team.map(m => m.employeeTypeId === id ? { ...m, employeeTypeId: "" } : m))
  }

  function togglePage(defId: string, page: PageKey) {
    set("employeeTypeDefs", data.employeeTypeDefs.map(d => {
      if (d.id !== defId) return d
      const pages = d.pageAccess.includes(page)
        ? d.pageAccess.filter(p => p !== page)
        : [...d.pageAccess, page]
      return { ...d, pageAccess: pages }
    }))
  }

  function toggleAction(defId: string, action: ActionKey) {
    set("employeeTypeDefs", data.employeeTypeDefs.map(d => {
      if (d.id !== defId) return d
      const acts = (d.actions ?? []).includes(action)
        ? (d.actions ?? []).filter(a => a !== action)
        : [...(d.actions ?? []), action]
      return { ...d, actions: acts }
    }))
  }

  function updateDefName(id: string, name: string) {
    set("employeeTypeDefs", data.employeeTypeDefs.map(d => d.id === id ? { ...d, name } : d))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Define employee types</h2>
          <p className="text-sm text-gray-500">Add the positions in your organization and configure their access levels.</p>
        </div>
      </div>

      {/* Preset grid */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add from preset</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EMPLOYEE_TYPE_PRESETS.map(preset => {
            const added = data.employeeTypeDefs.some(d => d.presetKey === preset.key)
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => addPreset(preset)}
                disabled={added}
                className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                  added
                    ? "border-blue-300 bg-blue-50 cursor-default"
                    : "border-gray-200 hover:border-blue-400 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium text-gray-900 leading-tight truncate">{preset.name}</span>
                  {added
                    ? <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    : <Plus className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${ROLE_COLORS[preset.baseRole] ?? "bg-gray-100 text-gray-700"}`}>
                  {preset.baseRole}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom type form */}
      {addingCustom ? (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
          <p className="text-xs font-semibold text-gray-600">Custom position</p>
          <Field label="Position name">
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="e.g. Field Technician"
              className={inputCls}
              autoFocus
            />
          </Field>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Page Access
              {customPages.size > 0 && (
                <span className="ml-1.5 text-blue-600 font-bold">{customPages.size}</span>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {CONFIGURABLE_PAGES.map(p => (
                <label key={p.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={customPages.has(p.key)}
                    onChange={() => {
                      setCustomPages(prev => {
                        const next = new Set(prev)
                        next.has(p.key) ? next.delete(p.key) : next.add(p.key)
                        return next
                      })
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Actions
              {customActions.size > 0 && (
                <span className="ml-1.5 text-blue-600 font-bold">{customActions.size}</span>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {CONFIGURABLE_ACTIONS.map(a => (
                <label key={a.key} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={customActions.has(a.key)}
                    onChange={() => {
                      setCustomActions(prev => {
                        const next = new Set(prev)
                        next.has(a.key) ? next.delete(a.key) : next.add(a.key)
                        return next
                      })
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="text-gray-700">{a.label}</span>
                    <p className="text-gray-400 text-[10px] leading-tight">{a.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={cancelCustom}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-white transition-colors">
              Cancel
            </button>
            <button type="button" onClick={addCustomType} disabled={!customName.trim()}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors">
              Add Position
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingCustom(true)}
          className="mb-4 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add custom position
        </button>
      )}

      {/* Defined types list */}
      {data.employeeTypeDefs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Added types</p>
          <div className="space-y-2">
            {data.employeeTypeDefs.map(def => (
              <div key={def.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">{def.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[def.baseRole] ?? "bg-gray-100 text-gray-700"}`}>
                      {def.baseRole}
                    </span>
                    {def.presetKey && (
                      <span className="text-xs text-indigo-500 shrink-0">preset</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === def.id ? null : def.id)}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {expandedId === def.id ? "Done" : "Edit access & functions"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDef(def.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {expandedId === def.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 bg-gray-50">
                    {!def.presetKey && (
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Position name</label>
                        <input
                          type="text"
                          value={def.name}
                          onChange={e => updateDefName(def.id, e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    )}
                    <p className="text-xs font-semibold text-gray-600 mb-2">Page Access</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mb-4">
                      {CONFIGURABLE_PAGES.map(p => (
                        <label key={p.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={def.pageAccess.includes(p.key)}
                            onChange={() => togglePage(def.id, p.key)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{p.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Actions</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {CONFIGURABLE_ACTIONS.map(a => (
                        <label key={a.key} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={(def.actions ?? []).includes(a.key)}
                            onChange={() => toggleAction(def.id, a.key)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
                          />
                          <div>
                            <span className="text-gray-700">{a.label}</span>
                            <p className="text-gray-400 text-[10px] leading-tight">{a.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.employeeTypeDefs.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">
          This step is optional — you can configure employee types later in Settings → Employee Types.
        </p>
      )}
    </div>
  )
}

// ─── Step 4b: Invite Personnel ────────────────────────────────────────────────

function Step4b({
  data,
  set,
}: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
}) {
  function updateMember(id: string, field: keyof Omit<TeamEntry, "id" | "title" | "role">, value: string) {
    set(
      "team",
      data.team.map(m => m.id === id ? { ...m, [field]: value } : m),
    )
  }

  function addInvitee() {
    set("team", [...data.team, { id: uid(), title: "", role: "EMPLOYEE", name: "", email: "", employeeTypeId: "" }])
  }

  function removeInvitee(id: string) {
    set("team", data.team.filter(m => m.id !== id))
  }

  const filledCount = data.team.filter(m => m.email.trim()).length

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
          <UserPlus className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Invite your team</h2>
          <p className="text-sm text-gray-500">Enter name and email — they&apos;ll receive an invite link. All invites are optional.</p>
        </div>
      </div>

      {data.team.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl mb-3">
          No invites yet. Add your first team member below.
        </div>
      )}

      <div className="space-y-3">
        {data.team.map((member, idx) => (
          <div key={member.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Invite {idx + 1}
              </p>
              <button
                type="button"
                onClick={() => removeInvitee(member.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" optional>
                <input
                  type="text"
                  value={member.name}
                  onChange={e => updateMember(member.id, "name", e.target.value)}
                  placeholder="Jane Smith"
                  className={inputCls}
                />
              </Field>
              <Field label="Email" optional>
                <input
                  type="email"
                  value={member.email}
                  onChange={e => updateMember(member.id, "email", e.target.value)}
                  placeholder="jane@company.com"
                  className={inputCls}
                />
              </Field>
              {data.employeeTypeDefs.length > 0 && (
                <Field label="Employee type" optional>
                  <select
                    value={member.employeeTypeId}
                    onChange={e => updateMember(member.id, "employeeTypeId", e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Default employee access</option>
                    {data.employeeTypeDefs.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addInvitee}
        className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus className="w-4 h-4" />
        Add another invite
      </button>

      {filledCount > 0 && (
        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          {filledCount} invitation{filledCount !== 1 ? "s" : ""} will be sent when you finish setup.
        </p>
      )}
    </div>
  )
}

// ─── Step 4 (wrapper with A/B sub-steps) ─────────────────────────────────────

function Step4({
  data,
  set,
  onGoNext,
  onGoBack,
}: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
  onGoNext: () => void
  onGoBack: () => void
}) {
  const [subStep, setSubStep] = useState<"types" | "invites">("types")

  function goToInvites() {
    if (data.team.length === 0) {
      set("team", [{ id: uid(), title: "", role: "EMPLOYEE", name: "", email: "", employeeTypeId: "" }])
    }
    setSubStep("invites")
  }

  return (
    <div>
      {/* Sub-step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${
          subStep === "types" ? "text-blue-700" : "text-gray-500"
        }`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${
            subStep === "invites"
              ? "bg-blue-600 text-white"
              : "bg-blue-600 text-white ring-2 ring-blue-100"
          }`}>
            {subStep === "invites" ? <Check className="w-3 h-3" /> : "A"}
          </div>
          Employee Types
        </div>
        <div className={`flex-1 h-px transition-colors ${subStep === "invites" ? "bg-blue-400" : "bg-gray-200"}`} />
        <div className={`flex items-center gap-1.5 text-xs font-medium ${
          subStep === "invites" ? "text-blue-700" : "text-gray-400"
        }`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${
            subStep === "invites" ? "bg-blue-600 text-white ring-2 ring-blue-100" : "bg-gray-200 text-gray-500"
          }`}>
            B
          </div>
          Invite Team
        </div>
      </div>

      {subStep === "types" ? (
        <Step4a data={data} set={set} />
      ) : (
        <Step4b data={data} set={set} />
      )}

      {/* Navigation — handled internally since step 4 has sub-steps */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={subStep === "types" ? onGoBack : () => setSubStep("types")}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          {subStep === "types" ? (
            <>
              <button
                type="button"
                onClick={goToInvites}
                className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={goToInvites}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Continue to Invites
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onGoNext}
                className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={onGoNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 5 ──────────────────────────────────────────────────────────────────

function Step5({
  data,
  set,
  categories,
  teamMembers,
}: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
  categories: IssueTypeOption[]
  teamMembers: TeamEntry[]
}) {
  function setRoute(category: string, value: string) {
    set("routing", { ...data.routing, [category]: value })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
          <Network className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">When an issue is reported, who should receive it?</h2>
          <p className="text-sm text-gray-500">Set initial routing for each issue type. You can refine this later.</p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-8">
          No issue types selected. Go back to Step 2 to choose categories.
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(({ label, category }) => (
            <div key={category} className="flex items-center justify-between gap-4 p-3 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">{label}</span>
              </div>
              <select
                value={data.routing[category] ?? ""}
                onChange={e => setRoute(category, e.target.value)}
                className="flex-shrink-0 w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select assignee…</option>
                {teamMembers.length > 0 && (
                  <optgroup label="Invited Team Members">
                    {teamMembers.map(m => (
                      <option key={m.id} value={`user:${m.email}`}>
                        {m.name || m.title} ({m.email})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="By Role">
                  <option value="role:MANAGER">Any Manager</option>
                  <option value="role:SUPERVISOR">Any Supervisor</option>
                  <option value="role:ADMIN">Admin</option>
                </optgroup>
              </select>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Routing rules can be edited any time from Settings → Routing Rules.
      </p>
    </div>
  )
}

// ─── Step 6 — Workspace Ready / Subscription Choice ──────────────────────────

function Step6({ router, data }: { router: ReturnType<typeof useRouter>; data: WizardData }) {
  const [starting,    setStarting]    = useState(false)
  const [trialError,  setTrialError]  = useState("")

  const isCarWash       = data.industry === "Car Wash"
  const employeeCount   = data.companySize       ? parseInt(data.companySize, 10)       || 10 : 10
  const locationCount   = data.numberOfLocations ? parseInt(data.numberOfLocations, 10) || 1  : 1

  async function startTrial() {
    setStarting(true)
    setTrialError("")
    try {
      const res = await fetch("/api/subscription/start-trial", { method: "POST" })
      if (!res.ok) { setTrialError("Failed to start trial. Please try again."); return }
      router.push("/dashboard")
    } catch {
      setTrialError("Network error. Please try again.")
    } finally {
      setStarting(false)
    }
  }

  function goToSubscribe() {
    const params = new URLSearchParams({
      employees: String(employeeCount),
      locations: String(locationCount),
      ...(isCarWash ? { industry: "car_wash" } : {}),
    })
    router.push(`/subscribe?${params.toString()}`)
  }

  const trialFeatures = isCarWash
    ? ["QR Customer Reporting", "Asset Tracking", "Issue Management", "Team Invites"]
    : ["Issues & Assets", "Team Management", "Analytics", "Intelligence Modules"]

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <PartyPopper className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isCarWash ? "Your Car Wash Workspace Is Ready" : "Your Relay Workspace Is Ready"}
        </h1>
        <p className="text-gray-500 text-sm">
          {isCarWash
            ? "Your bays, locations, and team invites have been configured. Start your free trial to explore the full platform."
            : "Your categories, locations, and team invites have been configured. Choose how you'd like to get started."}
        </p>
      </div>

      {trialError && (
        <p className="text-red-600 text-sm text-center mb-4">{trialError}</p>
      )}

      <div className="space-y-4">
        {/* Trial option */}
        <button
          type="button"
          onClick={startTrial}
          disabled={starting}
          className="w-full text-left p-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-2xl transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-lg">Start 14-Day Free Trial</p>
              <p className="text-blue-100 text-sm mt-1">
                Full access to all features. No credit card required.
                Your data is preserved for 30 days after expiry.
              </p>
            </div>
            {starting
              ? <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-1" />
              : <ChevronRight className="w-5 h-5 shrink-0 mt-1" />
            }
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {trialFeatures.map((f) => (
              <span key={f} className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">{f}</span>
            ))}
          </div>
        </button>

        {/* Subscribe option */}
        <button
          type="button"
          onClick={goToSubscribe}
          className="w-full text-left p-6 bg-white border-2 border-gray-200 hover:border-blue-400 rounded-2xl transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900 text-lg">Subscribe Now</p>
              <p className="text-gray-500 text-sm mt-1">
                {isCarWash
                  ? "Choose between Wash Essentials and Full Relay — Wash Edition."
                  : "Choose your plan and get started immediately. Essentials from $149/mo."}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {isCarWash
              ? ["Wash Essentials", "Full Relay — Wash Edition"].map((f) => (
                  <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{f}</span>
                ))
              : ["Essentials from $149/mo", "Professional from $299/mo"].map((f) => (
                  <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{f}</span>
                ))
            }
          </div>
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        You can always change your plan later from Settings → Subscription.
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SetupWizard({
  orgName,
  userId,
  initialIndustry,
  initialPlan,
}: {
  orgName: string
  userId: string
  initialIndustry?: string
  initialPlan?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<WizardData>(() => ({
    ...defaultData(orgName),
    ...(initialIndustry ? { industry: initialIndustry } : {}),
    ...(initialPlan     ? { packagePlan: initialPlan }  : {}),
  }))
  const [hydrated, setHydrated] = useState(false)

  // Load persisted progress from localStorage (initialIndustry wins if localStorage has none)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId))
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardData & { __step: number }>
        setData(d => ({
          ...d,
          ...parsed,
          // URL params take precedence over stale localStorage values
          ...(initialIndustry && !parsed.industry    ? { industry:    initialIndustry } : {}),
          ...(initialPlan     && !parsed.packagePlan ? { packagePlan: initialPlan }     : {}),
          __step: undefined,
        } as WizardData))
        if (typeof parsed.__step === "number" && parsed.__step > 1) {
          setStep(parsed.__step)
        }
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [userId, initialIndustry, initialPlan])

  // Persist progress on every change
  const persist = useCallback(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify({ ...data, __step: step }))
    } catch { /* ignore */ }
  }, [hydrated, userId, data, step])

  useEffect(() => { persist() }, [persist])

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }

  function canProceed() {
    switch (step) {
      case 1: return !!data.industry && (data.industry !== "Other" || !!data.industryOther?.trim())
      case 2: return data.issueTypes.length > 0
      default: return true
    }
  }

  // Get unique categories from selected issue types (first occurrence wins for label)
  function getSelectedCategories(): IssueTypeOption[] {
    const seen = new Set<string>()
    const result: IssueTypeOption[] = []
    for (const label of data.issueTypes) {
      const type = ISSUE_TYPES.find(t => t.label === label)
      if (type && !seen.has(type.category)) {
        seen.add(type.category)
        result.push(type)
      }
    }
    return result
  }

  function getFilledTeamMembers() {
    return data.team.filter(m => m.email.trim())
  }

  async function finish() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? "Something went wrong. Please try again.")
        setLoading(false)
        return
      }
      localStorage.removeItem(storageKey(userId))
      setStep(6)
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  function goNext() {
    setError("")
    setStep(s => s + 1)
  }

  function goBack() {
    setError("")
    setStep(s => s - 1)
  }

  const categories = getSelectedCategories()
  const teamMembers = getFilledTeamMembers()

  if (step === 6) {
    return <Step6 router={router} data={data} />
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Logo */}
      <div className="mb-8">
        <RelayWordmark height={36} />
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i + 1 < step
                    ? "bg-blue-600 text-white"
                    : i + 1 === step
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  i + 1 <= step ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 transition-colors ${
                  i + 1 < step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 1 && <Step1 data={data} set={set} />}
        {step === 2 && <Step2 data={data} set={set} />}
        {step === 3 && <Step3 data={data} set={set} />}
        {step === 4 && <Step4 data={data} set={set} onGoNext={goNext} onGoBack={goBack} />}
        {step === 5 && (
          <Step5
            data={data}
            set={set}
            categories={categories}
            teamMembers={teamMembers}
          />
        )}

        {/* Navigation — step 4 handles its own nav internally */}
        {step !== 4 && (
          <div className={`flex mt-8 ${step === 1 ? "justify-end" : "justify-between"}`}>
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}

            <div className="flex items-center gap-3">
              {/* Skip on optional steps */}
              {step === 3 && (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
                >
                  Skip for now
                </button>
              )}
              {step === 5 && (
                <button
                  type="button"
                  onClick={finish}
                  disabled={loading}
                  className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Skip for now
                </button>
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceed()}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Finish Setup</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Your 14-day free trial has started · No credit card required yet
      </p>
    </div>
  )
}
