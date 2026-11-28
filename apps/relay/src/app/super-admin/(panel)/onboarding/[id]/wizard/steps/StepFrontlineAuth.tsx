"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Smartphone, QrCode, CreditCard, Clock, Shield, Scan,
  CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp, KeyRound,
} from "lucide-react"
import type { FrontlineAuthPrefs } from "@/lib/wizard-steps"
import type { AuthPolicyConfig } from "@/lib/employee-session"

type Props = {
  onboardingId: string
  isPostLaunch: boolean
  onReady:    () => void
  onNotReady: () => void
}

// ── Part A defaults — actual org authPolicyConfig ────────────────────────────

const DEFAULT_POLICY: AuthPolicyConfig = {
  permittedMethods:          ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"],
  inactivityTimeoutSeconds:  null,
  maxSessionDurationSeconds: null,
  disableInactivityTimeout:  false,
  disableMaxSessionDuration: false,
}

// Preset inactivity timeouts shown as radio options.
// Matching preset displayed as selected; custom values respected but show "Custom".
const TIMEOUT_PRESETS = [
  { value: null,  label: "No auto-expiry",             description: "Sessions persist until manual logout. Suitable for single-user devices." },
  { value: 900,   label: "15 minutes of inactivity",   description: "Expires after 15 min of no interaction. Suitable for high-turnover shared kiosks." },
  { value: 3600,  label: "1 hour of inactivity",       description: "Expires after 1 hour of inactivity. Suitable for most shared-device deployments." },
  { value: 14400, label: "4 hours of inactivity",      description: "Expires after 4 hours of inactivity. Suitable for single-shift devices." },
] as const

type TimeoutPresetValue = null | 900 | 3600 | 14400

// Preset max session durations shown as radio options.
const MAX_DURATION_PRESETS = [
  { value: null,   label: "No hard limit",             description: "Sessions extend freely as long as the inactivity policy allows." },
  { value: 28800,  label: "8 hours",                   description: "Session hard-expires after 8 hours regardless of activity. Suitable for a full shift." },
  { value: 43200,  label: "12 hours",                  description: "Session hard-expires after 12 hours. Suitable for double-shift operations." },
  { value: 86400,  label: "24 hours",                  description: "Session hard-expires after 24 hours." },
] as const

type MaxDurationPresetValue = null | 28800 | 43200 | 86400

const METHOD_LABELS: Record<string, { label: string; detail: string }> = {
  EMPLOYEE_ID: {
    label:  "Employee ID lookup",
    detail: "Employee types their employee ID number. Relay finds their account by ID.",
  },
  ACCESS_CODE: {
    label:  "Access code (alphanumeric)",
    detail: "Employee enters a custom alphanumeric access code set by an admin. Not a numeric PIN — codes are configurable length and character set.",
  },
  BADGE: {
    label:  "Badge / barcode scan",
    detail: "Employee scans a QR code or barcode. Relay resolves their account from the enrolled credential.",
  },
}

// ── Part B defaults — advisory deployment planning (wizardProgress JSON) ─────

const DEFAULT_PREFS: FrontlineAuthPrefs = {
  useKioskMode:          false,
  useQrBadges:           false,
  useThirdPartyBadges:   false,
  useAccessCodeAuth:     false,
  hasIndustrialScanners: false,
  scannerVendor:         "",
  notes:                 "",
}

const SCANNER_VENDORS = [
  { value: "",            label: "Not using industrial scanners" },
  { value: "zebra",       label: "Zebra (DataWedge)" },
  { value: "honeywell",   label: "Honeywell (Scan Wedge)" },
  { value: "datalogic",   label: "Datalogic (Intent Wedge)" },
  { value: "urovo",       label: "Urovo" },
  { value: "unitech",     label: "Unitech" },
  { value: "cipherlab",   label: "CipherLab" },
  { value: "newland",     label: "Newland / NLS" },
  { value: "pointmobile", label: "Point Mobile" },
  { value: "chainway",    label: "Chainway" },
  { value: "bluebird",    label: "Bluebird" },
  { value: "other",       label: "Other / Unknown" },
]

const IT_SETUP_NOTES: Record<string, { action: string; detail: string }[]> = {
  zebra: [
    { action: "Relay auto-configuration available", detail: "Tap 'Configure DataWedge' in Relay Settings → Scanner. This creates a Relay-specific DataWedge profile without modifying other profiles." },
    { action: "Manual fallback", detail: "DataWedge → New Profile 'Relay' → Intent Output → Action: io.getrelay.app.ACTION_SCAN → Delivery: Broadcast." },
  ],
  honeywell: [
    { action: "IT must configure Scan Wedge", detail: "Settings → Honeywell Settings → Scanning → Scan Wedge → Intent Output → Action: io.getrelay.app.ACTION_SCAN. No acquisition commands needed from Relay." },
  ],
  datalogic: [
    { action: "IT must configure via ScanConfig app", detail: "ScanConfig → Intent Wedge → Enable → Action: com.datalogic.decode.action.SCAN. Relay reads the barcode_string extra automatically." },
  ],
  urovo: [
    { action: "IT must configure Intent Wedge", detail: "Device Settings → Scanner → Output Mode → Intent. Configure action: io.getrelay.app.ACTION_SCAN or leave as urovo.rcv.message (Relay reads both)." },
  ],
  default: [
    { action: "Configure Intent Wedge output on the device", detail: "Set the scan intent output action to io.getrelay.app.ACTION_SCAN and delivery type to Broadcast. Refer to your device manufacturer's documentation." },
  ],
}

export function StepFrontlineAuth({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  // Part A — actual authPolicyConfig for the org
  const [policy, setPolicy]       = useState<AuthPolicyConfig>(DEFAULT_POLICY)
  const [savingPolicy, setSavingPolicy] = useState(false)

  // Part B — advisory deployment planning (wizardProgress JSON)
  const [prefs, setPrefs]         = useState<FrontlineAuthPrefs>(DEFAULT_PREFS)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const [loading, setLoading]     = useState(true)
  const [showIt, setShowIt]       = useState(false)

  const [customTimeoutInput,     setCustomTimeoutInput]     = useState("")
  const [customTimeoutMode,      setCustomTimeoutMode]      = useState(false)
  const [customMaxDurationInput, setCustomMaxDurationInput] = useState("")
  const [customMaxDurationMode,  setCustomMaxDurationMode]  = useState(false)

  // Load both Part A (org policy) and Part B (advisory prefs) on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [policyRes, prefsRes] = await Promise.all([
          fetch(`/api/super-admin/onboarding/${onboardingId}/configure/auth-policy`),
          fetch(`/api/super-admin/onboarding/${onboardingId}/frontline-auth-prefs`),
        ])
        if (policyRes.ok) {
          const json = await policyRes.json() as { policy?: AuthPolicyConfig }
          if (json.policy) setPolicy(json.policy)
        }
        if (prefsRes.ok) {
          const json = await prefsRes.json() as { prefs?: FrontlineAuthPrefs }
          if (json.prefs) setPrefs(json.prefs)
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [onboardingId])

  // This step is optional; always signal ready
  useEffect(() => { onReady() }, [onReady])

  // Sync custom inputs when policy loads from server with an existing custom value
  useEffect(() => {
    if (policy.inactivityTimeoutSeconds !== null &&
        !TIMEOUT_PRESETS.some(p => p.value === policy.inactivityTimeoutSeconds)) {
      setCustomTimeoutInput(String(Math.round(policy.inactivityTimeoutSeconds / 60)))
    }
    if (policy.maxSessionDurationSeconds !== null &&
        !MAX_DURATION_PRESETS.some(p => p.value === policy.maxSessionDurationSeconds)) {
      setCustomMaxDurationInput(String(Math.round(policy.maxSessionDurationSeconds / 60)))
    }
  }, [policy.inactivityTimeoutSeconds, policy.maxSessionDurationSeconds])

  // ── Part A — save authPolicyConfig to org ───────────────────────────────────

  const savePolicy = useCallback(async (updated: Partial<AuthPolicyConfig>) => {
    if (isPostLaunch) return
    setSavingPolicy(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/auth-policy`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updated),
      })
      if (res.ok) {
        const json = await res.json() as { ok: boolean; policy?: AuthPolicyConfig }
        if (json.policy) setPolicy(json.policy)
      }
    } catch {
      // Best-effort
    } finally {
      setSavingPolicy(false)
    }
  }, [isPostLaunch, onboardingId])

  function toggleMethod(method: string, checked: boolean) {
    if (isPostLaunch) return
    const methods = checked
      ? [...policy.permittedMethods.filter(m => m !== method), method]
      : policy.permittedMethods.filter(m => m !== method)
    if (methods.length === 0) return  // must have at least one method
    const updated = { ...policy, permittedMethods: methods }
    setPolicy(updated)
    void savePolicy({ permittedMethods: methods })
  }

  function setTimeoutPreset(value: TimeoutPresetValue) {
    if (isPostLaunch) return
    setCustomTimeoutMode(false)
    const updated = { ...policy, inactivityTimeoutSeconds: value }
    setPolicy(updated)
    void savePolicy({ inactivityTimeoutSeconds: value })
  }

  function setMaxDurationPreset(value: MaxDurationPresetValue) {
    if (isPostLaunch) return
    setCustomMaxDurationMode(false)
    const updated = { ...policy, maxSessionDurationSeconds: value }
    setPolicy(updated)
    void savePolicy({ maxSessionDurationSeconds: value })
  }

  function applyCustomTimeout() {
    if (isPostLaunch) return
    const mins = parseInt(customTimeoutInput, 10)
    if (isNaN(mins) || mins < 1) return
    setCustomTimeoutMode(false)
    const updated = { ...policy, inactivityTimeoutSeconds: mins * 60 }
    setPolicy(updated)
    void savePolicy({ inactivityTimeoutSeconds: mins * 60 })
  }

  function applyCustomMaxDuration() {
    if (isPostLaunch) return
    const mins = parseInt(customMaxDurationInput, 10)
    if (isNaN(mins) || mins < 1) return
    setCustomMaxDurationMode(false)
    const updated = { ...policy, maxSessionDurationSeconds: mins * 60 }
    setPolicy(updated)
    void savePolicy({ maxSessionDurationSeconds: mins * 60 })
  }

  function toggleDisableInactivity(checked: boolean) {
    if (isPostLaunch) return
    const updated = { ...policy, disableInactivityTimeout: checked }
    setPolicy(updated)
    void savePolicy({ disableInactivityTimeout: checked })
  }

  function toggleDisableMaxDuration(checked: boolean) {
    if (isPostLaunch) return
    const updated = { ...policy, disableMaxSessionDuration: checked }
    setPolicy(updated)
    void savePolicy({ disableMaxSessionDuration: checked })
  }

  // ── Part B — save advisory prefs to wizardProgress ─────────────────────────

  const savePrefs = useCallback(async (updated: FrontlineAuthPrefs) => {
    if (isPostLaunch) return
    setSavingPrefs(true)
    try {
      await fetch(`/api/super-admin/onboarding/${onboardingId}/frontline-auth-prefs`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prefs: updated }),
      })
    } catch {
      // Best-effort; advisory prefs are not launch-blocking
    } finally {
      setSavingPrefs(false)
    }
  }, [isPostLaunch, onboardingId])

  function updatePref<K extends keyof FrontlineAuthPrefs>(key: K, value: FrontlineAuthPrefs[K]) {
    if (isPostLaunch) return
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    void savePrefs(updated)
  }

  const currentTimeoutPreset =
    (TIMEOUT_PRESETS as readonly { value: TimeoutPresetValue | number | null }[])
      .find(p => p.value === policy.inactivityTimeoutSeconds)?.value as TimeoutPresetValue | undefined

  const isCustomTimeout =
    policy.inactivityTimeoutSeconds !== null &&
    !TIMEOUT_PRESETS.some(p => p.value === policy.inactivityTimeoutSeconds)
  const showCustomTimeoutInput = customTimeoutMode || isCustomTimeout

  const currentMaxDurationPreset =
    (MAX_DURATION_PRESETS as readonly { value: MaxDurationPresetValue | number | null }[])
      .find(p => p.value === policy.maxSessionDurationSeconds)?.value as MaxDurationPresetValue | undefined

  const isCustomMaxDuration =
    policy.maxSessionDurationSeconds !== null &&
    !MAX_DURATION_PRESETS.some(p => p.value === policy.maxSessionDurationSeconds)
  const showCustomMaxDurationInput = customMaxDurationMode || isCustomMaxDuration

  const itNotes =
    prefs.scannerVendor && IT_SETUP_NOTES[prefs.scannerVendor]
      ? IT_SETUP_NOTES[prefs.scannerVendor]
      : (prefs.hasIndustrialScanners ? IT_SETUP_NOTES["default"] : null)

  const isSaving = savingPolicy || savingPrefs

  if (loading) {
    return <div className="text-sm text-gray-500 py-4">Loading…</div>
  }

  return (
    <div className="space-y-6">

      {/* Context note */}
      <div className="flex items-start gap-3 px-4 py-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-200">
          This step is optional. Part A configures the organization&apos;s actual authentication policy —
          which login methods are permitted and when sessions expire on shared devices.
          Part B captures deployment planning notes for the IT handoff.
        </p>
      </div>

      {/* ── PART A: Actual org auth policy ───────────────────────────────────── */}

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            Part A — Authentication Policy
          </h2>
          {isSaving && <span className="text-xs text-gray-500">Saving…</span>}
        </div>
        <p className="text-xs text-gray-500">
          These settings are written to the organization&apos;s authentication policy.
          They take effect immediately once the account is activated. The organization admin can
          adjust them later in Settings → Authentication Policy.
        </p>

        {/* Permitted authentication methods */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Permitted Login Methods</h3>
          <p className="text-xs text-gray-500">At least one method must remain enabled.</p>
          {Object.entries(METHOD_LABELS).map(([method, { label, detail }]) => (
            <label
              key={method}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                policy.permittedMethods.includes(method)
                  ? "bg-indigo-950/30 border-indigo-700"
                  : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
              } ${isPostLaunch ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                checked={policy.permittedMethods.includes(method)}
                onChange={e => toggleMethod(method, e.target.checked)}
                disabled={isPostLaunch}
                className="mt-0.5 accent-indigo-500"
              />
              <span>
                <span className="block text-sm text-gray-200 font-medium">{label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{detail}</span>
              </span>
            </label>
          ))}
        </div>

        {/* Session inactivity timeout */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Session Inactivity Timeout
          </h3>
          <p className="text-xs text-gray-500">
            Applies to employee sessions on registered devices. The organization admin can override
            per device in Settings → Registered Devices. Inactivity is measured by real user interaction
            (taps, scans, keystrokes) — not background activity.
          </p>
          <div className="space-y-2">
            {TIMEOUT_PRESETS.map(preset => (
              <label
                key={String(preset.value)}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  !showCustomTimeoutInput && currentTimeoutPreset === preset.value
                    ? "bg-indigo-950/30 border-indigo-700"
                    : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
                } ${isPostLaunch ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="inactivityTimeout"
                  checked={!showCustomTimeoutInput && currentTimeoutPreset === preset.value}
                  onChange={() => setTimeoutPreset(preset.value as TimeoutPresetValue)}
                  disabled={isPostLaunch}
                  className="mt-0.5 accent-indigo-500"
                />
                <span>
                  <span className="block text-sm text-gray-200 font-medium">{preset.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{preset.description}</span>
                </span>
              </label>
            ))}
            {/* Custom duration option — reveals a minute-precision input */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              showCustomTimeoutInput ? "bg-indigo-950/30 border-indigo-700" : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
            } ${isPostLaunch ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input
                type="radio"
                name="inactivityTimeout"
                checked={showCustomTimeoutInput}
                onChange={() => {
                  setCustomTimeoutMode(true)
                  if (!customTimeoutInput && policy.inactivityTimeoutSeconds)
                    setCustomTimeoutInput(String(Math.round(policy.inactivityTimeoutSeconds / 60)))
                }}
                disabled={isPostLaunch}
                className="mt-0.5 accent-indigo-500"
              />
              <span className="flex-1">
                <span className="block text-sm text-gray-200 font-medium">Custom duration</span>
                <span className="block text-xs text-gray-500 mt-0.5">Enter a specific inactivity timeout in minutes.</span>
                {showCustomTimeoutInput && (
                  <span className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={customTimeoutInput}
                      onChange={e => setCustomTimeoutInput(e.target.value)}
                      onBlur={applyCustomTimeout}
                      disabled={isPostLaunch}
                      placeholder="e.g. 30"
                      className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-xs text-gray-500">minutes</span>
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Max session duration */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Maximum Session Duration (Hard Limit)
          </h3>
          <p className="text-xs text-gray-500">
            Sets an absolute expiry from the original login time, regardless of activity.
            Useful for ensuring employees must re-authenticate at the start of each shift.
          </p>
          <div className="space-y-2">
            {MAX_DURATION_PRESETS.map(preset => (
              <label
                key={String(preset.value)}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  !showCustomMaxDurationInput && currentMaxDurationPreset === preset.value
                    ? "bg-indigo-950/30 border-indigo-700"
                    : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
                } ${isPostLaunch ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="maxDuration"
                  checked={!showCustomMaxDurationInput && currentMaxDurationPreset === preset.value}
                  onChange={() => setMaxDurationPreset(preset.value as MaxDurationPresetValue)}
                  disabled={isPostLaunch}
                  className="mt-0.5 accent-indigo-500"
                />
                <span>
                  <span className="block text-sm text-gray-200 font-medium">{preset.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{preset.description}</span>
                </span>
              </label>
            ))}
            {/* Custom duration option — reveals a minute-precision input */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              showCustomMaxDurationInput ? "bg-indigo-950/30 border-indigo-700" : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
            } ${isPostLaunch ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input
                type="radio"
                name="maxDuration"
                checked={showCustomMaxDurationInput}
                onChange={() => {
                  setCustomMaxDurationMode(true)
                  if (!customMaxDurationInput && policy.maxSessionDurationSeconds)
                    setCustomMaxDurationInput(String(Math.round(policy.maxSessionDurationSeconds / 60)))
                }}
                disabled={isPostLaunch}
                className="mt-0.5 accent-indigo-500"
              />
              <span className="flex-1">
                <span className="block text-sm text-gray-200 font-medium">Custom duration</span>
                <span className="block text-xs text-gray-500 mt-0.5">Enter a specific maximum session length in minutes.</span>
                {showCustomMaxDurationInput && (
                  <span className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="1"
                      max="10080"
                      value={customMaxDurationInput}
                      onChange={e => setCustomMaxDurationInput(e.target.value)}
                      onBlur={applyCustomMaxDuration}
                      disabled={isPostLaunch}
                      placeholder="e.g. 480"
                      className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-xs text-gray-500">minutes</span>
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Per-device override flags */}
        <div className="space-y-3 pt-2 border-t border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Device-Level Overrides</h3>
          <p className="text-xs text-gray-500">
            When enabled, individual registered devices can disable the inactivity timeout or maximum
            session duration independently of the organization default. Devices that disable both
            restrictions remain subject to the default 7-day session expiry and administrative revocation.
          </p>
          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={policy.disableInactivityTimeout}
              onChange={e => toggleDisableInactivity(e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium">Allow devices to disable inactivity timeout</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                A per-device override can disable inactivity-based expiry for dedicated single-user workstations.
              </span>
            </span>
          </label>
          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={policy.disableMaxSessionDuration}
              onChange={e => toggleDisableMaxDuration(e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium">Allow devices to disable maximum session duration</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                A per-device override can remove the hard limit for specific workstations (e.g. permanent
                supervisor stations where re-authentication at shift boundaries is not practical).
              </span>
            </span>
          </label>
        </div>
      </section>

      {/* ── PART B: Deployment planning (advisory) ──────────────────────────── */}

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-indigo-400" />
          Part B — Deployment Planning
        </h2>
        <p className="text-xs text-gray-500">
          Advisory notes captured for the IT handoff. These are not written to the organization&apos;s
          configuration — they are planning notes for the launch team.
        </p>

        {/* Deployment types */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Planned Deployment Types</h3>

          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.useKioskMode}
              onChange={e => updatePref("useKioskMode", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium">Shared-device kiosk mode</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                A fixed station where multiple employees scan in and out. Requires the Relay Android app.
              </span>
            </span>
          </label>

          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.useQrBadges}
              onChange={e => updatePref("useQrBadges", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 inline text-gray-400" />
                Relay-generated QR badges
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Relay generates a unique QR code per employee. Enrolled in the employee&apos;s Relay profile.
              </span>
            </span>
          </label>

          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.useThirdPartyBadges}
              onChange={e => updatePref("useThirdPartyBadges", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 inline text-gray-400" />
                Third-party badge / barcode cards
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Customer-issued ID cards (barcodes, QR, etc.) enrolled as Relay credentials.
                Authentication always validates against Relay — no global barcode lookup is performed.
                Org identity is established by device registration, not by badge content.
              </span>
            </span>
          </label>

          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.useAccessCodeAuth}
              onChange={e => updatePref("useAccessCodeAuth", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 inline text-gray-400" />
                Access code entry
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Employee enters a custom alphanumeric access code at the kiosk. Access codes are
                assigned and managed by an admin in the team panel. The permitted-method toggle
                in Part A controls whether this method is actually active on the account.
              </span>
            </span>
          </label>
        </div>

        {/* Scanner hardware */}
        {(prefs.useKioskMode || prefs.useQrBadges || prefs.useThirdPartyBadges) && (
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Scan className="w-3.5 h-3.5" />
              Scanner Hardware
            </h3>

            <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                checked={prefs.hasIndustrialScanners}
                onChange={e => updatePref("hasIndustrialScanners", e.target.checked)}
                disabled={isPostLaunch}
                className="mt-0.5 accent-indigo-500"
              />
              <span>
                <span className="block text-sm text-gray-200 font-medium">Customer has industrial barcode scanners</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Zebra, Honeywell, Datalogic, or similar Android scan engines. These require
                  IT-configured intent wedge output to deliver scans to Relay. Camera scanning
                  is always available as a fallback.
                </span>
              </span>
            </label>

            {prefs.hasIndustrialScanners && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Scanner vendor</label>
                <select
                  value={prefs.scannerVendor}
                  onChange={e => updatePref("scannerVendor", e.target.value)}
                  disabled={isPostLaunch}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {SCANNER_VENDORS.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* IT setup notes (collapsible) */}
        {itNotes && (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowIt(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
            >
              <span className="text-sm font-semibold text-white">IT Configuration Notes</span>
              {showIt ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {showIt && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
                <p className="text-xs text-gray-500 pt-3">
                  Share these steps with the customer&apos;s IT team. No Relay SDK or vendor partnership is required.
                </p>
                {itNotes.map((note, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-indigo-300 mb-1">{note.action}</p>
                    <p className="text-xs text-gray-400">{note.detail}</p>
                  </div>
                ))}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-950/30 border border-amber-900/40 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    Relay does not purchase or provision industrial scanners. All scanner hardware is sourced
                    and managed by the customer&apos;s IT team.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes for launch */}
        <div className="space-y-2 pt-2 border-t border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes for Launch</h3>
          <textarea
            value={prefs.notes}
            onChange={e => updatePref("notes", e.target.value)}
            disabled={isPostLaunch}
            rows={3}
            placeholder="e.g. 'Customer has 12 Zebra TC52 scanners. IT contact: John Smith. Plan to configure DataWedge profiles during launch week.'"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50"
          />
        </div>
      </section>

      {/* Summary */}
      <div className="flex items-center gap-2 px-4 py-3 bg-green-950/30 border border-green-800/40 rounded-xl">
        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
        <p className="text-sm text-green-300">
          Auth policy configured: {policy.permittedMethods.join(", ").replace(/EMPLOYEE_ID/, "Employee ID").replace(/ACCESS_CODE/, "Access Code").replace(/BADGE/, "Badge")}.{" "}
          {policy.inactivityTimeoutSeconds
            ? `Inactivity timeout: ${policy.inactivityTimeoutSeconds / 60} min.`
            : "No inactivity timeout."}
          {isSaving && <span className="text-green-500 ml-1 text-xs">Saving…</span>}
        </p>
      </div>

    </div>
  )
}
