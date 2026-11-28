"use client"

import { useState, useEffect } from "react"
import {
  Smartphone, QrCode, CreditCard, Clock, Shield, Scan,
  CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp,
} from "lucide-react"
import type { FrontlineAuthPrefs } from "@/lib/wizard-steps"

type Props = {
  onboardingId: string
  isPostLaunch: boolean
  onReady:    () => void
  onNotReady: () => void
}

const DEFAULT_PREFS: FrontlineAuthPrefs = {
  useKioskMode:          false,
  useQrBadges:           false,
  useThirdPartyBadges:   false,
  usePinAuth:            false,
  hasIndustrialScanners: false,
  scannerVendor:         "",
  sessionPolicy:         "default",
  notes:                 "",
}

const SESSION_POLICY_LABELS: Record<string, { label: string; description: string }> = {
  default: { label: "Default (no auto-expiry)", description: "Sessions persist until manual logout. Suitable for single-user devices." },
  short:   { label: "Short (15 min inactivity)", description: "Session expires after 15 min of no interaction. Suitable for high-turnover shared kiosks." },
  medium:  { label: "Medium (60 min inactivity)", description: "Session expires after 1 hour of inactivity. Suitable for most shared-device deployments." },
  long:    { label: "Long (4 hr inactivity)", description: "Session expires after 4 hours of inactivity. Suitable for single-shift shared devices." },
}

const SCANNER_VENDORS = [
  { value: "",           label: "Not using industrial scanners" },
  { value: "zebra",      label: "Zebra (DataWedge)" },
  { value: "honeywell",  label: "Honeywell (Scan Wedge)" },
  { value: "datalogic",  label: "Datalogic (Intent Wedge)" },
  { value: "urovo",      label: "Urovo" },
  { value: "unitech",    label: "Unitech" },
  { value: "cipherlab",  label: "CipherLab" },
  { value: "newland",    label: "Newland / NLS" },
  { value: "pointmobile",label: "Point Mobile" },
  { value: "chainway",   label: "Chainway" },
  { value: "bluebird",   label: "Bluebird" },
  { value: "other",      label: "Other / Unknown" },
]

const IT_SETUP_NOTES: Record<string, { action: string; detail: string }[]> = {
  zebra: [
    { action: "Relay auto-configuration available", detail: "Tap the 'Configure DataWedge' button in Relay Settings → Scanner. This creates a Relay-specific DataWedge profile without modifying other profiles." },
    { action: "Manual fallback", detail: "DataWedge → New Profile 'Relay' → Intent Output → Action: io.getrelay.app.ACTION_SCAN → Delivery: Broadcast." },
  ],
  honeywell: [
    { action: "IT must configure Scan Wedge", detail: "Settings → Honeywell Settings → Scanning → Scan Wedge → Intent Output → Action: io.getrelay.app.ACTION_SCAN. No acquisition commands needed from Relay." },
  ],
  datalogic: [
    { action: "IT must configure via ScanConfig app", detail: "ScanConfig → Intent Wedge → Enable → Action: com.datalogic.decode.action.SCAN (default). Relay reads the barcode_string extra automatically." },
  ],
  urovo: [
    { action: "IT must configure Intent Wedge", detail: "Device Settings → Scanner → Output Mode → Intent. Configure action: io.getrelay.app.ACTION_SCAN or leave as urovo.rcv.message (Relay reads both)." },
  ],
  default: [
    { action: "Configure Intent Wedge output on the device", detail: "Set the scan intent output action to io.getrelay.app.ACTION_SCAN and delivery type to Broadcast. Refer to your device manufacturer's documentation." },
  ],
}

export function StepFrontlineAuth({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [prefs, setPrefs]     = useState<FrontlineAuthPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [showIt, setShowIt]   = useState(false)

  // Load saved prefs from onboarding notes (stored as a JSON blob in notes field)
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/frontline-auth-prefs`)
        if (res.ok) {
          const json = await res.json() as { prefs?: FrontlineAuthPrefs }
          if (json.prefs) setPrefs(json.prefs)
        }
      } catch {
        // No saved prefs — use defaults
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [onboardingId])

  // This step is optional; always call onReady so it doesn't block navigation.
  useEffect(() => {
    onReady()
  }, [onReady])

  async function savePrefs(updated: FrontlineAuthPrefs) {
    if (isPostLaunch) return
    setSaving(true)
    try {
      await fetch(`/api/super-admin/onboarding/${onboardingId}/frontline-auth-prefs`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prefs: updated }),
      })
    } catch {
      // Best-effort; prefs are advisory, not launch-blocking
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof FrontlineAuthPrefs>(key: K, value: FrontlineAuthPrefs[K]) {
    if (isPostLaunch) return
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    void savePrefs(updated)
  }

  const anyAuthMethodSelected = prefs.useKioskMode || prefs.useQrBadges || prefs.useThirdPartyBadges || prefs.usePinAuth

  const itNotes = prefs.scannerVendor && IT_SETUP_NOTES[prefs.scannerVendor]
    ? IT_SETUP_NOTES[prefs.scannerVendor]
    : (prefs.hasIndustrialScanners ? IT_SETUP_NOTES["default"] : null)

  if (loading) {
    return <div className="text-sm text-gray-500 py-4">Loading…</div>
  }

  return (
    <div className="space-y-6">

      {/* Context note */}
      <div className="flex items-start gap-3 px-4 py-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-200">
          This step is optional. Complete it when the customer deploys shared devices or kiosk stations
          where frontline workers authenticate by scanning badges or QR codes.
          No data is committed to the customer&apos;s account from this screen.
        </p>
      </div>

      {/* Auth methods */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          Authentication Methods
        </h2>
        <p className="text-xs text-gray-500">
          Select which scan-based login methods this customer plans to use on frontline devices.
          Standard email/password login always remains available.
        </p>

        <div className="space-y-3">
          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.useKioskMode}
              onChange={e => update("useKioskMode", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium">Shared-device kiosk mode</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                A fixed station where multiple employees scan in and out. Requires the Relay Android app.
                Employees authenticate with badges or QR codes; no personal devices needed.
              </span>
            </span>
          </label>

          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.useQrBadges}
              onChange={e => update("useQrBadges", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 inline text-gray-400" />
                Relay-generated QR badges
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Relay generates a unique QR code per employee. The employee scans it at a kiosk.
                Badge enrollment is managed in the employee&apos;s Relay profile.
              </span>
            </span>
          </label>

          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.useThirdPartyBadges}
              onChange={e => update("useThirdPartyBadges", e.target.checked)}
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
              checked={prefs.usePinAuth}
              onChange={e => update("usePinAuth", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium">PIN code login</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Employee enters a numeric PIN at the kiosk. PINs are set by managers in the team panel.
              </span>
            </span>
          </label>
        </div>
      </section>

      {/* Scanner deployment */}
      {(prefs.useKioskMode || prefs.useQrBadges || prefs.useThirdPartyBadges) && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Scan className="w-4 h-4 text-indigo-400" />
            Scanner Hardware
          </h2>

          <label className={`flex items-start gap-3 cursor-pointer ${isPostLaunch ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={prefs.hasIndustrialScanners}
              onChange={e => update("hasIndustrialScanners", e.target.checked)}
              disabled={isPostLaunch}
              className="mt-0.5 accent-indigo-500"
            />
            <span>
              <span className="block text-sm text-gray-200 font-medium">Customer has industrial barcode scanners</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Zebra, Honeywell, Datalogic, or similar Android scan engines. These require IT-configured
                intent wedge output to deliver scans to Relay. Camera scanning is always available as a fallback.
              </span>
            </span>
          </label>

          {prefs.hasIndustrialScanners && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Scanner vendor</label>
              <select
                value={prefs.scannerVendor}
                onChange={e => update("scannerVendor", e.target.value)}
                disabled={isPostLaunch}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              >
                {SCANNER_VENDORS.map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          )}
        </section>
      )}

      {/* IT setup instructions */}
      {itNotes && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowIt(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-800/50 transition-colors"
          >
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              IT Configuration Notes
            </span>
            {showIt ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>

          {showIt && (
            <div className="px-5 pb-5 space-y-4 border-t border-gray-800">
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
                  and managed by the customer&apos;s IT team. Relay reads scan broadcasts; it does not
                  control scanner hardware directly.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Session policy */}
      {prefs.useKioskMode && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Session Timeout Policy
          </h2>
          <p className="text-xs text-gray-500">
            Applies to employee sessions on registered kiosk devices. The admin can override this per device
            in Relay Settings → Registered Devices after launch. Inactivity is measured by real user interaction
            (taps, scans, keystrokes) — not background keep-alives.
          </p>

          <div className="space-y-2">
            {Object.entries(SESSION_POLICY_LABELS).map(([key, { label, description }]) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  prefs.sessionPolicy === key
                    ? "bg-indigo-950/30 border-indigo-700"
                    : "bg-gray-800/40 border-gray-700 hover:border-gray-600"
                } ${isPostLaunch ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="sessionPolicy"
                  value={key}
                  checked={prefs.sessionPolicy === key}
                  onChange={() => update("sessionPolicy", key as FrontlineAuthPrefs["sessionPolicy"])}
                  disabled={isPostLaunch}
                  className="mt-0.5 accent-indigo-500"
                />
                <span>
                  <span className="block text-sm text-gray-200 font-medium">{label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Notes for Launch</h2>
        <textarea
          value={prefs.notes}
          onChange={e => update("notes", e.target.value)}
          disabled={isPostLaunch}
          rows={3}
          placeholder="e.g. 'Customer has 12 Zebra TC52 scanners. IT contact: John Smith. Plan to configure DataWedge profiles during launch week.'"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50"
        />
      </section>

      {/* Summary */}
      {anyAuthMethodSelected && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-950/30 border border-green-800/40 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300">
            Frontline auth preferences saved.
            {saving && <span className="text-green-500 ml-1 text-xs">Saving…</span>}
          </p>
        </div>
      )}

    </div>
  )
}
