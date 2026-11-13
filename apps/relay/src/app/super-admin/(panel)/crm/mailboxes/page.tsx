"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Mail, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, RefreshCw, Send, Server,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MailboxConfig {
  emailAddress: string
  host:         string
  port:         number
  smtpHost:     string
  smtpPort:     number
  enabled:      boolean
  lastSyncAt:   string | null
  hasPassword:  boolean
}

interface RepRow {
  id:       string
  name:     string
  email:    string
  isActive: boolean
  mailbox:  MailboxConfig | null
}

type TestStatus = "idle" | "running" | "ok" | "failed"

interface TestResult {
  status:  TestStatus
  message: string
  log?:    string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "Never"
  try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }
  catch { return iso }
}

function StatusDot({ configured, hasPassword }: { configured: boolean; hasPassword?: boolean }) {
  if (!configured) return (
    <span className="inline-block w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" title="Not configured" />
  )
  if (!hasPassword) return (
    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Missing password" />
  )
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Configured" />
  )
}

function TestResultBadge({ result }: { result: TestResult }) {
  if (result.status === "idle") return null
  if (result.status === "running") return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
      <Loader2 className="w-3 h-3 animate-spin" />Testing…
    </div>
  )
  if (result.status === "ok") return (
    <div className="flex items-start gap-1.5 text-[11px] text-green-400">
      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
      <span>{result.message}</span>
    </div>
  )
  return (
    <div className="flex items-start gap-1.5 text-[11px] text-red-400">
      <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
      <span>{result.message}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MailboxManagementPage() {
  const [reps,         setReps]         = useState<RepRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState<string | null>(null)
  const [selected,     setSelected]     = useState<RepRow | null>(null)

  // Update form state
  const [formEmail,    setFormEmail]    = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formHost,     setFormHost]     = useState("imap.titan.email")
  const [formPort,     setFormPort]     = useState("993")
  const [formSmtpHost, setFormSmtpHost] = useState("smtp.titan.email")
  const [formSmtpPort, setFormSmtpPort] = useState("465")
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null)
  const [saveError,    setSaveError]    = useState<string | null>(null)

  // Test state
  const [imapTest, setImapTest] = useState<TestResult>({ status: "idle", message: "" })
  const [smtpTest, setSmtpTest] = useState<TestResult>({ status: "idle", message: "" })
  const [sendTo,   setSendTo]   = useState("")
  const [sendTest, setSendTest] = useState<TestResult>({ status: "idle", message: "" })

  const loadReps = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res  = await fetch("/api/super-admin/crm/mailboxes")
      const data = await res.json() as RepRow[]
      setReps(data)
    } catch {
      setLoadError("Failed to load mailbox configurations")
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadReps() }, [loadReps])

  function selectRep(rep: RepRow) {
    setSelected(rep)
    setFormEmail(rep.mailbox?.emailAddress ?? rep.email)
    setFormPassword("")
    setFormHost(rep.mailbox?.host ?? "imap.titan.email")
    setFormPort(String(rep.mailbox?.port ?? 993))
    setFormSmtpHost(rep.mailbox?.smtpHost ?? "smtp.titan.email")
    setFormSmtpPort(String(rep.mailbox?.smtpPort ?? 465))
    setSaveMsg(null)
    setSaveError(null)
    setImapTest({ status: "idle", message: "" })
    setSmtpTest({ status: "idle", message: "" })
    setSendTest({ status: "idle", message: "" })
    setSendTo("")
  }

  async function handleSave() {
    if (!selected) return
    if (!formPassword) { setSaveError("Password is required to save mailbox settings"); return }
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      const res = await fetch(`/api/super-admin/sales-users/${selected.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:      "update_imap",
          imapEmail:   formEmail,
          imapPassword: formPassword,
          imapHost:    formHost,
          imapPort:    parseInt(formPort, 10) || 993,
          smtpHost:    formSmtpHost,
          smtpPort:    parseInt(formSmtpPort, 10) || 465,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Save failed (${res.status})`)
      }
      setSaveMsg("Mailbox settings saved")
      setFormPassword("")
      // Refresh list to show updated status
      await loadReps()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally { setSaving(false) }
  }

  async function runAction(action: string, setter: (r: TestResult) => void, to?: string) {
    if (!selected) return
    setter({ status: "running", message: "" })
    try {
      const res  = await fetch(`/api/super-admin/crm/mailboxes/${selected.id}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, ...(to ? { to } : {}) }),
      })
      const data = await res.json() as { ok?: boolean; message?: string; error?: string; log?: string[] }
      if (data.ok) {
        setter({ status: "ok", message: data.message ?? "Success", log: data.log })
      } else {
        setter({ status: "failed", message: data.error ?? "Failed", log: data.log })
      }
    } catch (err) {
      setter({ status: "failed", message: err instanceof Error ? err.message : "Request failed" })
    }
  }

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
  const labelCls = "block text-[11px] font-medium text-gray-400 mb-1"

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-indigo-400" />
          <div>
            <h1 className="text-sm font-semibold text-white">Mailbox Management</h1>
            <p className="text-[11px] text-gray-500">View, configure, and test sales rep email accounts</p>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* ── Left: Rep List ───────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
          <div className="p-3 flex items-center justify-between border-b border-gray-800">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Sales Reps</span>
            <button onClick={() => void loadReps()} className="text-gray-600 hover:text-gray-300 p-1 rounded transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          )}

          {loadError && (
            <div className="p-3 text-xs text-red-400">{loadError}</div>
          )}

          {!loading && !loadError && reps.length === 0 && (
            <div className="p-4 text-xs text-gray-500 text-center">No sales users found</div>
          )}

          {!loading && reps.map(rep => (
            <button
              key={rep.id}
              onClick={() => selectRep(rep)}
              className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-gray-900 transition-colors border-b border-gray-800/50 ${selected?.id === rep.id ? "bg-gray-900" : ""}`}
            >
              <StatusDot configured={!!rep.mailbox} hasPassword={rep.mailbox?.hasPassword} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{rep.name}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {rep.mailbox?.emailAddress ?? rep.email}
                </p>
                {rep.mailbox && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    Last sync: {formatDate(rep.mailbox.lastSyncAt)}
                  </p>
                )}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* ── Right: Configuration Panel ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <Mail className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium">Select a sales rep</p>
              <p className="text-sm text-gray-600 mt-1">Choose a rep from the list to view or configure their email account.</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-6 space-y-6">

              {/* Identity */}
              <div>
                <h2 className="text-base font-semibold text-white">{selected.name}</h2>
                <p className="text-sm text-gray-400">{selected.email}</p>
                {!selected.isActive && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">Inactive</span>
                )}
              </div>

              {/* Current Status */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Current Configuration</p>
                {!selected.mailbox ? (
                  <div className="flex items-center gap-2 text-sm text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    No mailbox configured — emails will fall back to Resend
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <p className="text-gray-500 mb-0.5">Sender Address</p>
                      <p className="text-white font-mono">{selected.mailbox.emailAddress}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Password</p>
                      <p className="text-white">{selected.mailbox.hasPassword ? "••••••••" : <span className="text-red-400">Not set</span>}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">IMAP</p>
                      <p className="text-white font-mono">{selected.mailbox.host}:{selected.mailbox.port}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">SMTP</p>
                      <p className="text-white font-mono">{selected.mailbox.smtpHost}:{selected.mailbox.smtpPort}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Last Sync</p>
                      <p className="text-white">{formatDate(selected.mailbox.lastSyncAt)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Status</p>
                      <p className={selected.mailbox.enabled ? "text-green-400" : "text-amber-400"}>
                        {selected.mailbox.enabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Update Settings */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Update Settings</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Email Address (IMAP username + sender address)</label>
                    <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className={inputCls} placeholder="user@domain.com" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Password {selected.mailbox?.hasPassword && <span className="text-gray-600">(leave blank to keep current)</span>}</label>
                    <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} className={inputCls} placeholder={selected.mailbox?.hasPassword ? "Enter new password to change" : "Required"} autoComplete="new-password" />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Server className="w-2.5 h-2.5" /> IMAP Server
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>Host</label>
                      <input type="text" value={formHost} onChange={e => setFormHost(e.target.value)} className={inputCls} placeholder="imap.titan.email" />
                    </div>
                    <div>
                      <label className={labelCls}>Port</label>
                      <input type="number" value={formPort} onChange={e => setFormPort(e.target.value)} className={inputCls} placeholder="993" />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Send className="w-2.5 h-2.5" /> SMTP Server
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>Host</label>
                      <input type="text" value={formSmtpHost} onChange={e => setFormSmtpHost(e.target.value)} className={inputCls} placeholder="smtp.titan.email" />
                    </div>
                    <div>
                      <label className={labelCls}>Port</label>
                      <input type="number" value={formSmtpPort} onChange={e => setFormSmtpPort(e.target.value)} className={inputCls} placeholder="465" />
                    </div>
                  </div>
                </div>

                {saveMsg && (
                  <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                    <CheckCircle2 className="w-3 h-3" />{saveMsg}
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center gap-1.5 text-[11px] text-red-400">
                    <XCircle className="w-3 h-3" />{saveError}
                  </div>
                )}

                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : "Save Settings"}
                </button>
              </div>

              {/* Connection Tests */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Connection Tests</p>

                {/* IMAP test */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void runAction("test_imap", setImapTest)}
                      disabled={imapTest.status === "running" || !selected.mailbox}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {imapTest.status === "running"
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Testing…</>
                        : "Test IMAP Connection"
                      }
                    </button>
                    {!selected.mailbox && <span className="text-[11px] text-gray-600">Configure mailbox first</span>}
                  </div>
                  <TestResultBadge result={imapTest} />
                  {imapTest.log && imapTest.log.length > 0 && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400">Show IMAP log ({imapTest.log.length} lines)</summary>
                      <pre className="mt-1 text-[9px] text-gray-500 bg-gray-800/50 rounded p-2 overflow-x-auto leading-relaxed max-h-32 overflow-y-auto">
                        {imapTest.log.join("\n")}
                      </pre>
                    </details>
                  )}
                </div>

                {/* SMTP test */}
                <div className="space-y-2 border-t border-gray-800 pt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void runAction("test_smtp", setSmtpTest)}
                      disabled={smtpTest.status === "running" || !selected.mailbox}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {smtpTest.status === "running"
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Testing…</>
                        : "Test SMTP Connection"
                      }
                    </button>
                  </div>
                  <TestResultBadge result={smtpTest} />
                </div>

                {/* Send test email */}
                <div className="space-y-2 border-t border-gray-800 pt-4">
                  <p className="text-[11px] text-gray-400 font-medium">Send Test Email</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      placeholder="Recipient email…"
                      value={sendTo}
                      onChange={e => setSendTo(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => void runAction("send_test", setSendTest, sendTo)}
                      disabled={sendTest.status === "running" || !selected.mailbox || !sendTo.trim()}
                      className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
                    >
                      {sendTest.status === "running"
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Sending…</>
                        : <><Send className="w-3 h-3" />Send</>
                      }
                    </button>
                  </div>
                  <TestResultBadge result={sendTest} />
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
