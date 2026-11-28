"use client"

import { useState, useEffect, useCallback } from "react"
import { X, RefreshCw, Plus, Trash2, QrCode, Barcode, Copy, Check, KeyRound, CreditCard, ShieldCheck, ScanLine } from "lucide-react"
import { toast } from "@/lib/toast"
import { useScannerField } from "@/lib/scanner-bus"
import { ScanButton } from "@/components/scanner/camera-scanner"

interface Badge {
  id: string
  badgeType: string
  maskedDisplay: string | null
  isActive: boolean
  createdAt: string
}

interface CredentialState {
  employeeId: string | null
  credential: {
    employeeIdEnabled: boolean
    accessCodeEnabled: boolean
    accessCodeMasked: string | null
  }
  badges: Badge[]
}

interface Props {
  userId: string
  userName: string
  onClose: () => void
}

function badgeTypeLabel(t: string) {
  if (t === "RELAY_QR")     return "Relay QR"
  if (t === "RELAY_BARCODE") return "Relay Barcode"
  if (t === "THIRD_PARTY")  return "Third-party"
  return t
}

export function EmployeeCredentialsModal({ userId, userName, onClose }: Props) {
  const [data, setData]       = useState<CredentialState | null>(null)
  const [loading, setLoading] = useState(true)

  // Inline edit state
  const [employeeIdDraft, setEmployeeIdDraft] = useState("")
  const [accessCodeDraft, setAccessCodeDraft] = useState("")
  const [thirdPartyDraft, setThirdPartyDraft] = useState("")

  // Once-visible raw values after generation
  const [revealedCode, setRevealedCode]   = useState<string | null>(null)
  const [revealedBadge, setRevealedBadge] = useState<{ raw: string; type: string } | null>(null)
  const [copied, setCopied]               = useState(false)

  const [saving, setSaving]  = useState(false)
  const [err, setErr]        = useState<string | null>(null)

  // Scanner enrollment for third-party badge
  const [badgeEnrollOpen, setBadgeEnrollOpen] = useState(false)
  const scanFieldRef = useScannerField((value) => {
    setThirdPartyDraft(value)
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/team/${userId}/credentials`)
      if (!res.ok) { setErr("Failed to load credentials"); return }
      const json = await res.json() as CredentialState
      setData(json)
      setEmployeeIdDraft(json.employeeId ?? "")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  async function saveEmployeeId() {
    setSaving(true); setErr(null)
    const res = await fetch(`/api/team/${userId}/credentials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: employeeIdDraft.trim() || null }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Failed"); return }
    toast.success("Employee ID updated.")
    await load()
  }

  async function toggleMethod(field: "employeeIdEnabled" | "accessCodeEnabled", current: boolean) {
    setSaving(true); setErr(null)
    const res = await fetch(`/api/team/${userId}/credentials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !current }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Failed"); return }
    await load()
  }

  async function generateAccessCode() {
    setSaving(true); setErr(null); setRevealedCode(null)
    const res = await fetch(`/api/team/${userId}/credentials/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ACCESS_CODE" }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Failed"); return }
    const d = await res.json() as { rawValue: string }
    setRevealedCode(d.rawValue)
    await load()
  }

  async function generateBadge(type: "RELAY_QR" | "RELAY_BARCODE") {
    setSaving(true); setErr(null); setRevealedBadge(null)
    const res = await fetch(`/api/team/${userId}/credentials/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Failed"); return }
    const d = await res.json() as { rawValue: string }
    setRevealedBadge({ raw: d.rawValue, type })
    await load()
  }

  async function addThirdPartyBadge() {
    if (!thirdPartyDraft.trim()) { setErr("Badge value is required"); return }
    setSaving(true); setErr(null)
    const res = await fetch(`/api/team/${userId}/badges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeType: "THIRD_PARTY", credentialValue: thirdPartyDraft.trim() }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Failed"); return }
    setThirdPartyDraft("")
    toast.success("Badge registered.")
    await load()
  }

  async function revokeBadge(badgeId: string) {
    setSaving(true); setErr(null)
    const res = await fetch(`/api/team/${userId}/badges/${badgeId}`, { method: "DELETE" })
    setSaving(false)
    if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Failed"); return }
    toast.success("Badge revoked.")
    await load()
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  const activeBadges = data?.badges.filter(b => b.isActive) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Employee Credentials</h3>
            <p className="text-xs text-gray-400 mt-0.5">{userName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {loading && (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Loading…</div>
        )}

        {!loading && data && (
          <div className="px-6 py-5 space-y-6">
            {err && (
              <div className="p-2.5 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">{err}</div>
            )}

            {/* ── Employee ID ─────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-medium text-gray-800">Employee ID</h4>
                {data.credential.employeeIdEnabled && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Enabled</span>
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. EMP-001"
                  value={employeeIdDraft}
                  onChange={e => setEmployeeIdDraft(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={saveEmployeeId}
                  disabled={saving}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  Save
                </button>
              </div>
              {data.employeeId && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={data.credential.employeeIdEnabled}
                      onChange={() => toggleMethod("employeeIdEnabled", data.credential.employeeIdEnabled)}
                      disabled={saving}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Enable Employee ID login
                  </label>
                </div>
              )}
            </section>

            {/* ── Access Code ─────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-medium text-gray-800">Access Code</h4>
                {data.credential.accessCodeEnabled && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Enabled</span>
                )}
              </div>

              {data.credential.accessCodeMasked ? (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-700 font-mono bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg flex-1">
                    {data.credential.accessCodeMasked}
                  </span>
                  <button
                    onClick={generateAccessCode}
                    disabled={saving}
                    title="Generate new code"
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-60"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateAccessCode}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-60 mb-2"
                >
                  <Plus className="w-4 h-4" />
                  Generate access code
                </button>
              )}

              {/* Once-visible code reveal */}
              {revealedCode && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2">
                  <p className="text-xs text-amber-700 mb-1 font-medium">Save this code — it won&apos;t be shown again</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-amber-900 tracking-widest">{revealedCode}</span>
                    <button
                      onClick={() => copyToClipboard(revealedCode)}
                      className="p-1.5 rounded hover:bg-amber-100 text-amber-700"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {data.credential.accessCodeMasked && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={data.credential.accessCodeEnabled}
                    onChange={() => toggleMethod("accessCodeEnabled", data.credential.accessCodeEnabled)}
                    disabled={saving}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Enable access code login
                </label>
              )}
            </section>

            {/* ── Badges ──────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-medium text-gray-800">Badges</h4>
                <span className="text-xs text-gray-400">{activeBadges.length} active</span>
              </div>

              {activeBadges.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {activeBadges.map(badge => (
                    <div key={badge.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="text-xs text-gray-500 w-24 shrink-0">{badgeTypeLabel(badge.badgeType)}</span>
                      <span className="font-mono text-xs text-gray-700 flex-1 truncate">{badge.maskedDisplay ?? "—"}</span>
                      <button
                        onClick={() => revokeBadge(badge.id)}
                        disabled={saving}
                        title="Revoke badge"
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Once-visible badge reveal */}
              {revealedBadge && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <p className="text-xs text-amber-700 mb-1 font-medium">
                    {revealedBadge.type === "RELAY_QR" ? "Encode this in a QR code" : "Encode this in a barcode"} — it won&apos;t be shown again
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-900 break-all">{revealedBadge.raw}</span>
                    <button
                      onClick={() => copyToClipboard(revealedBadge.raw)}
                      className="p-1.5 rounded hover:bg-amber-100 text-amber-700 shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Add badge actions */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => generateBadge("RELAY_QR")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Add QR Badge
                </button>
                <button
                  onClick={() => generateBadge("RELAY_BARCODE")}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  Add Barcode
                </button>
              </div>

              {/* Third-party badge */}
              <details open={badgeEnrollOpen} onToggle={e => setBadgeEnrollOpen((e.currentTarget as HTMLDetailsElement).open)} className="group">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 list-none flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Register third-party badge
                </summary>
                <div className="mt-2 space-y-2">
                  {/* Manual / paste entry */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type, paste, or scan badge value"
                      value={thirdPartyDraft}
                      onChange={e => setThirdPartyDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && thirdPartyDraft.trim()) { e.preventDefault(); void addThirdPartyBadge() } }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addThirdPartyBadge}
                      disabled={saving || !thirdPartyDraft.trim()}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-60"
                    >
                      Register
                    </button>
                  </div>

                  {/* Dedicated scanner input field (for USB/BT wedge scanners) */}
                  <div className="border border-dashed border-gray-200 rounded-lg p-2">
                    <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                      <ScanLine className="w-3.5 h-3.5" />
                      Hardware scanner — click field, then scan
                    </p>
                    <input
                      ref={scanFieldRef}
                      data-scanner-field="true"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Click here, then scan badge…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer font-mono tracking-widest"
                      title="Click to focus, then scan your badge"
                    />
                  </div>

                  {/* Camera scanner */}
                  <ScanButton
                    label="Scan with camera"
                    onScan={(value) => {
                      setThirdPartyDraft(value)
                    }}
                  />
                </div>
              </details>
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
