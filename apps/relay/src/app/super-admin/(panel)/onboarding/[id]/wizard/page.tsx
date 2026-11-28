"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, ChevronRight, Check, Minus, ArrowRight, Loader2,
  CheckCircle2, Circle, AlertTriangle, Building2, Settings, Users,
  MapPin, FileText, QrCode, Bell, Rocket, Flag, UserPlus,
} from "lucide-react"
import {
  WIZARD_STEPS, type WizardStepWithStatus, type WizardProgress,
} from "@/lib/wizard-steps"
import { StepOverview }       from "./steps/StepOverview"
import { StepLocations }      from "./steps/StepLocations"
import { StepDepartments }    from "./steps/StepDepartments"
import { StepEmployeeTypes }  from "./steps/StepEmployeeTypes"
import { StepIssueSettings }  from "./steps/StepIssueSettings"
import { StepNotifications }  from "./steps/StepNotifications"
import { StepSOPs }           from "./steps/StepSOPs"
import { StepQrCodes }        from "./steps/StepQrCodes"
import { StepFeatureFlags }   from "./steps/StepFeatureFlags"
import { StepEmployees }      from "./steps/StepEmployees"

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardData = {
  id:                  string
  organizationId:      string
  organizationName:    string
  plan:                string
  status:              string
  primaryContactName:  string
  primaryContactEmail: string
  trialStartDate:      string | null
  isDemo:              boolean
  isPostLaunch:        boolean
  steps:               WizardStepWithStatus[]
  totalSteps:          number
  completedCount:      number
  skippedCount:        number
  progress:            WizardProgress
  dataReadiness:       Record<string, boolean>
}

// Steps whose completion is determined by real data counts, not manual marking
const DATA_DRIVEN_STEPS = new Set(["overview", "locations", "departments", "employee-types", "employee-list", "sops", "qr-codes"])

// ── Icons per step ────────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "overview":        Building2,
  "locations":       MapPin,
  "departments":     Building2,
  "employee-types":  Users,
  "issue-settings":  Settings,
  "notifications":   Bell,
  "sops":            FileText,
  "qr-codes":        QrCode,
  "feature-flags":   Flag,
  "employee-list":   UserPlus,
  "readiness":       Rocket,
}

// ── Status colors / icons for sidebar ────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", configuring: "Configuring", ready_for_review: "Ready for Review",
  ready_to_launch: "Ready to Launch", invitation_sent: "Invitation Sent", live: "Live",
}
const STATUS_COLOR: Record<string, string> = {
  draft:            "bg-gray-800 text-gray-400 border-gray-700",
  configuring:      "bg-blue-900/50 text-blue-300 border-blue-700",
  ready_for_review: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  ready_to_launch:  "bg-indigo-900/50 text-indigo-300 border-indigo-700",
  invitation_sent:  "bg-purple-900/50 text-purple-300 border-purple-700",
  live:             "bg-green-900/50 text-green-300 border-green-700",
}
const PLAN_LABEL: Record<string, string> = {
  essentials: "Essentials", professional: "Professional", custom: "Custom",
}

// ── Placeholder content per step ─────────────────────────────────────────────

const STEP_PLACEHOLDER: Record<string, { heading: string; lines: string[] }> = {
  overview: {
    heading: "Review customer information before setup begins.",
    lines: [
      "Confirm the primary contact name and email address.",
      "Verify the plan and estimated facility count.",
      "Set the trial start date — required before launch.",
    ],
  },
  locations: {
    heading: "Configure the customer's physical locations.",
    lines: [
      "Add each facility, plant, or site the customer operates.",
      "Nest sub-locations (wings, floors, zones) under their parent.",
      "Locations appear in QR codes, departments, and issue routing.",
    ],
  },
  departments: {
    heading: "Define the customer's organizational structure.",
    lines: [
      "Add departments and assign them to locations.",
      "Departments are used to scope issues and QR codes.",
      "At least one department is recommended before launch.",
    ],
  },
  "employee-types": {
    heading: "Define the roles employees can hold in Relay.",
    lines: [
      "Create employee type definitions with a base permission level.",
      "Base roles: Employee, Supervisor, Manager, HR, Admin.",
      "Employee types are selectable when managers invite team members.",
    ],
  },
  "issue-settings": {
    heading: "Configure how issues are captured and prioritized.",
    lines: [
      "Set priority rules (High / Medium / Low thresholds).",
      "Customize terminology — rename 'Issue' to match the customer's vocabulary.",
      "Configure notification rules for each priority level.",
    ],
  },
  notifications: {
    heading: "Set up alerts, escalations, and injury reporting.",
    lines: [
      "Configure notification rules for unacknowledged issues.",
      "Set escalation thresholds and recipient roles.",
      "Add injury alert email recipients for high-severity events.",
    ],
  },
  sops: {
    heading: "Create standard operating procedures for common scenarios.",
    lines: [
      "SOPs are suggested to employees when they open related issues.",
      "Add a title, description, and step-by-step content.",
      "SOPs can be scoped to specific departments.",
    ],
  },
  "qr-codes": {
    heading: "Create QR scan points for locations and check-ins.",
    lines: [
      "QR codes let employees report issues by scanning a posted sign.",
      "Assign each QR code to a location and optionally a department.",
      "Codes can be set to public, private, or PIN-protected modes.",
    ],
  },
  "feature-flags": {
    heading: "Enable the product capabilities this customer needs.",
    lines: [
      "QR codes, regions, executive briefings, health scores, and more.",
      "Advanced escalations and trend detection can be enabled here.",
      "Feature flags take effect immediately in the customer's environment.",
    ],
  },
  "employee-list": {
    heading: "Prepare the employee invitation list for post-launch.",
    lines: [
      "Collect employee names, emails, and roles before the customer logs in.",
      "These invitations are NOT sent until the customer accepts their account.",
      "The customer's admin can also invite employees directly after launch.",
    ],
  },
  readiness: {
    heading: "Final review before sending the customer invitation.",
    lines: [
      "Primary contact email and trial start date must be set.",
      "Confirm at least one location, department, and QR code.",
      "When ready, advance status to 'Ready to Launch' on the detail page.",
    ],
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData]       = useState<WizardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Local step key — initialized from server progress, then managed locally
  const [currentKey, setCurrentKey] = useState<string>(WIZARD_STEPS[0].key)

  // Track which steps have been completed/skipped locally (mirrors server state)
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set())
  const [skippedSet, setSkippedSet]     = useState<Set<string>>(new Set())

  // Data-driven readiness: initialized from server dataReadiness, updated by step components
  const [stepReadyMap, setStepReadyMap] = useState<Record<string, boolean>>({})

  // Ref to avoid stale closures in save functions
  const currentKeyRef = useRef(currentKey)
  useEffect(() => { currentKeyRef.current = currentKey }, [currentKey])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${id}/wizard`)
      if (!res.ok) throw new Error("Not found")
      const json = await res.json() as WizardData
      setData(json)
      const p = json.progress
      setCurrentKey(p.currentStepKey ?? WIZARD_STEPS[0].key)
      setCompletedSet(new Set(p.completedSteps))
      setSkippedSet(new Set(p.skippedSteps))
      setStepReadyMap(json.dataReadiness ?? {})
    } catch {
      setError("Failed to load wizard.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveProgress(patch: {
    currentStepKey?: string
    markCompleted?:  string
    markSkipped?:    string
    unmarkStep?:     string
  }) {
    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${id}/wizard-progress`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Save failed")
      }
      const result = await res.json() as { progress: WizardProgress; statusAdvanced: string | null }
      // If status auto-advanced, update local data for the header badge
      if (result.statusAdvanced && data) {
        setData(d => d ? { ...d, status: result.statusAdvanced! } : d)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  // Stable callbacks for the current step component's onReady/onNotReady
  const handleCurrentStepReady = useCallback(() => {
    setStepReadyMap(m => ({ ...m, [currentKey]: true }))
  }, [currentKey])
  const handleCurrentStepNotReady = useCallback(() => {
    setStepReadyMap(m => ({ ...m, [currentKey]: false }))
  }, [currentKey])

  // ── Navigation ────────────────────────────────────────────────────────────

  const stepIndex   = WIZARD_STEPS.findIndex(s => s.key === currentKey)
  const isFirstStep = stepIndex === 0
  const isLastStep  = stepIndex === WIZARD_STEPS.length - 1
  const isPostLaunch = data?.isPostLaunch ?? false

  function getStepStatus(key: string): "current" | "completed" | "skipped" | "incomplete" {
    if (key === currentKey) return "current"
    // Data-driven steps: use stepReadyMap instead of manual completedSet
    if (DATA_DRIVEN_STEPS.has(key)) {
      return stepReadyMap[key] ? "completed" : "incomplete"
    }
    if (completedSet.has(key)) return "completed"
    if (skippedSet.has(key))   return "skipped"
    return "incomplete"
  }

  async function handleNext() {
    if (isLastStep) return
    const nextKey        = WIZARD_STEPS[stepIndex + 1].key
    const isDataDriven   = DATA_DRIVEN_STEPS.has(currentKey)
    // For data-driven steps, server derives completion from real data — don't manually mark
    if (!isDataDriven) {
      setCompletedSet(s => new Set([...s, currentKey]))
      skippedSet.delete(currentKey)
    }
    setCurrentKey(nextKey)
    await saveProgress({
      currentStepKey: nextKey,
      ...(isDataDriven ? {} : { markCompleted: currentKey }),
    })
  }

  async function handlePrev() {
    if (isFirstStep) return
    const prevKey = WIZARD_STEPS[stepIndex - 1].key
    setCurrentKey(prevKey)
    await saveProgress({ currentStepKey: prevKey })
  }

  async function handleSkip() {
    if (isLastStep || isPostLaunch) return
    const nextKey = WIZARD_STEPS[stepIndex + 1].key
    setSkippedSet(s => new Set([...s, currentKey]))
    completedSet.delete(currentKey)
    setCurrentKey(nextKey)
    await saveProgress({ currentStepKey: nextKey, markSkipped: currentKey })
  }

  async function handleSidebarClick(key: string) {
    if (key === currentKey) return
    setCurrentKey(key)
    await saveProgress({ currentStepKey: key })
  }

  async function handleSaveAndExit() {
    await saveProgress({ currentStepKey: currentKeyRef.current })
    router.push(`/super-admin/onboarding/${id}`)
  }

  async function handleMarkComplete(key: string) {
    setCompletedSet(s => new Set([...s, key]))
    setSkippedSet(s => { const n = new Set(s); n.delete(key); return n })
    await saveProgress({ markCompleted: key })
  }

  async function handleUnmark(key: string) {
    setCompletedSet(s => { const n = new Set(s); n.delete(key); return n })
    setSkippedSet(s => { const n = new Set(s); n.delete(key); return n })
    await saveProgress({ unmarkStep: key })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-screen gap-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
        <p className="text-gray-400 text-sm">{error ?? "Wizard not found."}</p>
        <Link href={`/super-admin/onboarding/${id}`} className="text-indigo-400 hover:text-indigo-300 text-sm">
          ← Back to onboarding record
        </Link>
      </div>
    )
  }

  const currentStepDef = WIZARD_STEPS.find(s => s.key === currentKey) ?? WIZARD_STEPS[0]
  const placeholder    = STEP_PLACEHOLDER[currentKey] ?? { heading: "", lines: [] }
  const StepIcon       = STEP_ICONS[currentKey] ?? Circle
  // Count completed: data-driven steps use stepReadyMap, manual steps use completedSet
  const completedCount = WIZARD_STEPS.filter(s =>
    DATA_DRIVEN_STEPS.has(s.key) ? stepReadyMap[s.key] : completedSet.has(s.key)
  ).length
  const pct            = Math.round((completedCount / WIZARD_STEPS.length) * 100)
  const currentStepIsDataDriven = DATA_DRIVEN_STEPS.has(currentKey)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-5 py-3">
        <div className="flex items-center gap-4">
          {/* Back link */}
          <Link
            href={`/super-admin/onboarding/${id}`}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Link>

          {/* Org name + badges */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-bold text-white truncate">{data.organizationName}</span>
            <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-900/40 border border-indigo-800/60 px-1.5 py-0.5 rounded flex-shrink-0">
              {PLAN_LABEL[data.plan] ?? data.plan}
            </span>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${STATUS_COLOR[data.status] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
            {data.isDemo && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/60 flex-shrink-0">
                TEST
              </span>
            )}
            {isPostLaunch && (
              <span className="text-[11px] text-gray-500 flex-shrink-0">(read-only after launch)</span>
            )}
          </div>

          {/* Progress bar + count */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 tabular-nums">{completedCount}/{WIZARD_STEPS.length}</span>
            </div>

            {saving && <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin flex-shrink-0" />}

            <button
              onClick={handleSaveAndExit}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            >
              Save &amp; Exit
            </button>
          </div>
        </div>

        {/* Mobile progress bar */}
        <div className="sm:hidden mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-gray-500">{completedCount}/{WIZARD_STEPS.length}</span>
        </div>

        {error && (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded px-2 py-1">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
          </div>
        )}
      </header>

      {/* ── Body: sidebar + content ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <nav className="hidden md:flex flex-col w-64 flex-shrink-0 bg-gray-950 border-r border-gray-800 overflow-y-auto py-3">
          {WIZARD_STEPS.map(step => {
            const status  = getStepStatus(step.key)
            const isCur   = status === "current"
            const isDone  = status === "completed"
            const isSkip  = status === "skipped"
            const SIcon   = STEP_ICONS[step.key] ?? Circle

            return (
              <button
                key={step.key}
                onClick={() => handleSidebarClick(step.key)}
                className={[
                  "group w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  isCur
                    ? "bg-indigo-900/30 border-l-2 border-indigo-500"
                    : "border-l-2 border-transparent hover:bg-gray-900/60",
                ].join(" ")}
              >
                {/* Step indicator */}
                <span className={[
                  "flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold transition-colors",
                  isCur  ? "bg-indigo-600 border-indigo-500 text-white"
                  : isDone ? "bg-green-900/50 border-green-700 text-green-400"
                  : isSkip ? "bg-gray-800 border-gray-700 text-gray-500"
                  : "bg-gray-900 border-gray-700 text-gray-600 group-hover:border-gray-600",
                ].join(" ")}>
                  {isDone ? <Check className="w-3 h-3" />
                  : isSkip ? <Minus className="w-3 h-3" />
                  : step.number}
                </span>

                {/* Title + optional badge */}
                <span className="flex-1 min-w-0">
                  <span className={[
                    "block text-xs font-semibold truncate",
                    isCur  ? "text-indigo-200"
                    : isDone ? "text-gray-400"
                    : isSkip ? "text-gray-600"
                    : "text-gray-400 group-hover:text-gray-300",
                  ].join(" ")}>
                    {step.title}
                  </span>
                  {step.optional && !isDone && !isSkip && (
                    <span className="text-[10px] text-gray-600">optional</span>
                  )}
                </span>

                {/* Right-side icon */}
                {isCur && <ArrowRight className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                {isDone && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
              </button>
            )
          })}
        </nav>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">

            {/* Step header */}
            <div className="flex items-start gap-4 mb-8">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-900/40 border border-indigo-800/50 flex items-center justify-center">
                <StepIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Step {currentStepDef.number} of {WIZARD_STEPS.length}
                  </span>
                  {currentStepDef.optional && (
                    <span className="text-[10px] font-semibold text-gray-600 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded">
                      Optional
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-white mb-1">{currentStepDef.title}</h1>
                <p className="text-sm text-gray-400">{currentStepDef.description}</p>
              </div>
            </div>

            {/* Post-launch notice */}
            {isPostLaunch && (
              <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-sm text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                This customer has been launched. Configuration changes are locked.
              </div>
            )}

            {/* Step completion badge */}
            {getStepStatus(currentKey) === "completed" && (
              <div className="mb-6 flex items-center gap-2 px-4 py-2.5 bg-green-950/30 border border-green-800/40 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-300 font-medium">
                  {currentStepIsDataDriven ? "Step complete — data configured" : "Step marked complete"}
                </span>
                {!currentStepIsDataDriven && (
                  <button
                    onClick={() => handleUnmark(currentKey)}
                    disabled={saving || isPostLaunch}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
                  >
                    Unmark
                  </button>
                )}
              </div>
            )}

            {getStepStatus(currentKey) === "skipped" && (
              <div className="mb-6 flex items-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl">
                <Minus className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-500 font-medium">Step skipped</span>
                <button
                  onClick={() => handleUnmark(currentKey)}
                  disabled={saving || isPostLaunch}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
                >
                  Restore
                </button>
              </div>
            )}

            {/* Step content */}
            <div className="mb-6">
              {currentKey === "overview" && (
                <StepOverview
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "locations" && (
                <StepLocations
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "departments" && (
                <StepDepartments
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "employee-types" && (
                <StepEmployeeTypes
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "employee-list" && (
                <StepEmployees
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "issue-settings" && (
                <StepIssueSettings
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "notifications" && (
                <StepNotifications
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "sops" && (
                <StepSOPs
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "qr-codes" && (
                <StepQrCodes
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {currentKey === "feature-flags" && (
                <StepFeatureFlags
                  key={currentKey}
                  onboardingId={id}
                  isPostLaunch={isPostLaunch}
                  onReady={handleCurrentStepReady}
                  onNotReady={handleCurrentStepNotReady}
                />
              )}
              {!DATA_DRIVEN_STEPS.has(currentKey) && currentKey !== "issue-settings" && currentKey !== "notifications" && currentKey !== "feature-flags" && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <p className="text-sm font-semibold text-gray-200 mb-4">{placeholder.heading}</p>
                  <ul className="space-y-3">
                    {placeholder.lines.map((line, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500/60 mt-2" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Mobile step list */}
            <div className="md:hidden mb-6">
              <details className="bg-gray-900 border border-gray-800 rounded-xl">
                <summary className="px-4 py-3 text-xs font-semibold text-gray-400 cursor-pointer select-none">
                  All steps — {completedCount}/{WIZARD_STEPS.length} complete
                </summary>
                <div className="px-2 pb-3 space-y-1">
                  {WIZARD_STEPS.map(step => {
                    const status = getStepStatus(step.key)
                    return (
                      <button
                        key={step.key}
                        onClick={() => handleSidebarClick(step.key)}
                        className={[
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors",
                          step.key === currentKey
                            ? "bg-indigo-900/30 text-indigo-200 font-semibold"
                            : "text-gray-400 hover:bg-gray-800/60",
                        ].join(" ")}
                      >
                        <span className={`flex-shrink-0 ${
                          status === "completed" ? "text-green-400" :
                          status === "skipped" ? "text-gray-600" :
                          status === "current" ? "text-indigo-400" :
                          "text-gray-600"
                        }`}>
                          {status === "completed" ? <Check className="w-3.5 h-3.5" />
                          : status === "skipped"   ? <Minus className="w-3.5 h-3.5" />
                          : status === "current"   ? <ArrowRight className="w-3.5 h-3.5" />
                          : <Circle className="w-3.5 h-3.5" />}
                        </span>
                        <span className="truncate">{step.number}. {step.title}</span>
                      </button>
                    )
                  })}
                </div>
              </details>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handlePrev}
                disabled={isFirstStep || saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {/* Skip — only for optional steps, only pre-launch */}
                {currentStepDef.optional && !isPostLaunch && !isLastStep && (
                  <button
                    onClick={handleSkip}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-30"
                  >
                    Skip
                  </button>
                )}

                {/* Mark Complete — only for non-data-driven steps */}
                {!isPostLaunch && !currentStepIsDataDriven && getStepStatus(currentKey) !== "completed" && (
                  <button
                    onClick={() => handleMarkComplete(currentKey)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-400 hover:text-green-300 bg-green-950/30 hover:bg-green-950/50 border border-green-900/50 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark Complete
                  </button>
                )}

                {/* Next */}
                {!isLastStep ? (
                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSaveAndExit}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Rocket className="w-4 h-4" />
                    Finish & Review
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
