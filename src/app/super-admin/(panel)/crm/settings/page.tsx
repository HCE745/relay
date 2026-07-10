"use client"

import { useState, useEffect } from "react"
import {
  Settings, Mail, Server, BookOpen, Plus, Pencil, Trash2, Check,
  X, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Clock, CheckCircle2, AlertCircle,
} from "lucide-react"

type Tab = "templates" | "imap" | "guide" | "debug"

interface Template {
  id:       string
  name:     string
  subject:  string
  body:     string
  isSystem: boolean
}

interface ImapConfig {
  id:                 string
  host:               string
  port:               number
  smtpHost:           string
  smtpPort:           number
  emailAddress:       string
  lastSyncAt:         string | null
  lastSyncEmailCount: number
  enabled:            boolean
}

interface SyncRunResult {
  fetched:  number
  matched:  number
  saved:    number
  skipped:  number
  errors:   string[]
}

export default function CrmSettingsPage() {
  const [tab, setTab] = useState<Tab>("templates")

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">CRM Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800 pb-0">
        {([
          { key: "templates", label: "Email Templates", icon: Mail },
          { key: "imap",      label: "IMAP / SMTP",     icon: Server },
          { key: "guide",     label: "Setup Guide",     icon: BookOpen },
          { key: "debug",     label: "Diagnostics",     icon: AlertCircle },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "templates" && <TemplatesTab />}
      {tab === "imap"      && <ImapTab />}
      {tab === "guide"     && <GuideTab />}
      {tab === "debug"     && <DiagnosticsTab />}
    </div>
  )
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates,   setTemplates]   = useState<Template[]>([])
  const [loading,     setLoading]     = useState(true)
  const [creating,    setCreating]    = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [form,        setForm]        = useState({ name: "", subject: "", body: "" })
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState("")

  async function load() {
    setLoading(true)
    const r = await fetch("/api/super-admin/crm/email-templates")
    const d = await r.json() as { templates: Template[] }
    setTemplates(d.templates)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save() {
    if (!form.name || !form.subject || !form.body) { setError("All fields required"); return }
    setSaving(true); setError("")
    const url    = editingId ? `/api/super-admin/crm/email-templates/${editingId}` : "/api/super-admin/crm/email-templates"
    const method = editingId ? "PATCH" : "POST"
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (!res.ok) { const d = await res.json() as { error: string }; setError(d.error); setSaving(false); return }
    setCreating(false); setEditingId(null); setForm({ name: "", subject: "", body: "" }); void load()
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm("Delete this template?")) return
    await fetch(`/api/super-admin/crm/email-templates/${id}`, { method: "DELETE" })
    void load()
  }

  function startEdit(t: Template) {
    setEditingId(t.id); setForm({ name: t.name, subject: t.subject, body: t.body }); setCreating(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Templates support merge tags: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">{"{{contact_name}}"}</code>{" "}
          <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">{"{{company_name}}"}</code>{" "}
          <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">{"{{demo_date}}"}</code>
        </p>
        {!creating && (
          <button
            onClick={() => { setCreating(true); setEditingId(null); setForm({ name: "", subject: "", body: "" }) }}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">{editingId ? "Edit Template" : "New Template"}</h3>
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Template name (e.g. Demo Follow-Up)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
          />
          <input
            value={form.subject}
            onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            placeholder="Subject line"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
          />
          <textarea
            value={form.body}
            onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
            placeholder="Email body (plain text; use {{contact_name}}, {{company_name}}, {{demo_date}})"
            rows={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 resize-y font-mono"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              <Check className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setCreating(false); setEditingId(null) }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Loading templates…</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-800/40 transition-colors"
                onClick={() => setExpanded(v => v === t.id ? null : t.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{t.name}</span>
                    {t.isSystem && (
                      <span className="text-[10px] bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded-full">system</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={e => { e.stopPropagation(); startEdit(t) }}
                    className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); void del(t.id) }}
                    className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {expanded === t.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </div>
              {expanded === t.id && (
                <div className="border-t border-gray-800 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">Subject: {t.subject}</p>
                  <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">{t.body}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── IMAP / SMTP Tab ──────────────────────────────────────────────────────────

interface ConnectionTest {
  ok:   boolean
  text: string
}

function ImapTab() {
  const [config,       setConfig]       = useState<ImapConfig | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [editing,      setEditing]      = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [busy,         setBusy]         = useState(false)   // covers reset + test + sync
  const [phase,        setPhase]        = useState("")      // human-readable current step
  const [connTest,     setConnTest]     = useState<ConnectionTest | null>(null)
  const [syncMsg,      setSyncMsg]      = useState<{ text: string; ok: boolean } | null>(null)
  const [syncResult,   setSyncResult]   = useState<SyncRunResult | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState("")
  const [form, setForm] = useState({
    host: "imap.titan.email", port: 993,
    smtpHost: "smtp.titan.email", smtpPort: 465,
    emailAddress: "", password: "", enabled: true,
  })

  async function load() {
    setLoading(true)
    const r = await fetch("/api/super-admin/crm/imap-config", { credentials: "include" })
    const d = await r.json() as { config: ImapConfig | null }
    setConfig(d.config)
    if (d.config) {
      setForm(p => ({
        ...p,
        host: d.config!.host, port: d.config!.port,
        smtpHost: d.config!.smtpHost, smtpPort: d.config!.smtpPort,
        emailAddress: d.config!.emailAddress, enabled: d.config!.enabled,
      }))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save() {
    if (!form.emailAddress) { setError("Email address required"); return }
    if (!config && !form.password) { setError("Password required for new configuration"); return }
    setSaving(true); setError("")
    const res = await fetch("/api/super-admin/crm/imap-config", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ ...form, password: form.password || undefined }),
    })
    const d = await res.json() as { config?: ImapConfig; syncTriggered?: boolean; error?: string }
    if (!res.ok) { setError(d.error ?? "Save failed"); setSaving(false); return }
    setEditing(false)
    setSaving(false)
    if (d.syncTriggered) {
      setSyncMsg({ text: "Configuration saved. Initial sync started in the background — check back in a moment.", ok: true })
    }
    void load()
  }

  // ── Step: test IMAP connection ─────────────────────────────────────────────
  async function testConnection(): Promise<boolean> {
    setPhase("Testing IMAP connection…")
    setConnTest(null)
    try {
      const res = await fetch("/api/super-admin/crm/test-imap", { credentials: "include" })
      if (res.status === 401) {
        setConnTest({ ok: false, text: "Session not recognised — try refreshing the page and signing in again." })
        return false
      }
      const data = await res.json() as {
        env?:      { IMAP_ENCRYPTION_KEY?: string }
        decrypt?:  { status: string; error?: string }
        attempts?: { config: string; status: string; error?: { message?: string; responseText?: string; response?: string } }[]
      }
      const encKey  = data.env?.IMAP_ENCRYPTION_KEY ?? "unknown"
      const decrypt = data.decrypt?.status ?? "unknown"
      const conn0   = data.attempts?.[0]
      const connOk  = conn0?.status === "ok"
      if (!connOk) {
        const errDetail = conn0?.error?.responseText ?? conn0?.error?.response ?? conn0?.error?.message ?? "no detail"
        setConnTest({ ok: false, text: `IMAP connection failed (${conn0?.config ?? "n/a"}): ${errDetail} | enc-key: ${encKey} | decrypt: ${decrypt}` })
        return false
      }
      setConnTest({ ok: true, text: `IMAP connected OK (${conn0.config}) | enc-key: ${encKey} | decrypt: ${decrypt}` })
      return true
    } catch (err) {
      setConnTest({ ok: false, text: `test-imap request failed: ${err instanceof Error ? err.message : String(err)}` })
      return false
    }
  }

  // ── Step: run the actual sync ──────────────────────────────────────────────
  async function runSync() {
    setPhase("Syncing emails…")
    setSyncResult(null)
    try {
      const res  = await fetch("/api/super-admin/crm/run-imap-sync", {
        method:      "POST",
        credentials: "include",
      })
      let data: SyncRunResult & { error?: string }
      try {
        data = await res.json() as SyncRunResult & { error?: string }
      } catch {
        setSyncMsg({ text: `Sync returned non-JSON (status ${res.status}) — check Vercel logs`, ok: false })
        return
      }
      if (!res.ok || data.error) {
        setSyncMsg({ text: data.error ?? `Sync failed (HTTP ${res.status})`, ok: false })
      } else {
        setSyncResult(data)
        const summary = `Sync complete — fetched ${data.fetched}, saved ${data.saved}, skipped ${data.skipped}`
        if (data.errors.length) {
          setSyncMsg({ text: `${summary} — ${data.errors.length} error(s), see below`, ok: false })
        } else {
          setSyncMsg({ text: summary, ok: true })
        }
      }
    } catch (err) {
      setSyncMsg({ text: err instanceof Error ? err.message : "Sync request failed", ok: false })
    }
  }

  // ── Reset + test + sync ────────────────────────────────────────────────────
  async function resetAndSync() {
    setBusy(true); setSyncMsg(null); setSyncResult(null); setConnTest(null)

    // 1. Reset lastSyncAt so the 90-day window is used
    setPhase("Resetting sync history…")
    try {
      const res = await fetch("/api/super-admin/crm/imap-config", {
        method:      "PATCH",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ resetSyncHistory: true }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setSyncMsg({ text: d.error ?? "Reset failed", ok: false })
        setBusy(false); setPhase("")
        return
      }
    } catch (err) {
      setSyncMsg({ text: err instanceof Error ? err.message : "Reset request failed", ok: false })
      setBusy(false); setPhase("")
      return
    }

    // 2. Test connection first — confirms auth + credentials work before sync
    const connOk = await testConnection()
    if (!connOk) {
      setBusy(false); setPhase("")
      return
    }

    // 3. Run the full sync
    await runSync()
    void load()
    setBusy(false); setPhase("")
  }

  // ── Quick sync (no reset, no pre-test) ────────────────────────────────────
  async function syncNow() {
    setBusy(true); setSyncMsg(null); setSyncResult(null); setConnTest(null)
    await runSync()
    void load()
    setBusy(false); setPhase("")
  }

  if (loading) return <p className="text-sm text-gray-500 py-4">Loading…</p>

  return (
    <div className="space-y-5">
      {/* Sync status banner */}
      {syncMsg && (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm border ${
          syncMsg.ok
            ? "bg-green-950/40 border-green-800/40 text-green-300"
            : "bg-red-950/40 border-red-800/40 text-red-300"
        }`}>
          {syncMsg.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          {syncMsg.text}
        </div>
      )}

      {/* Manual Sync card */}
      {config && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                Manual Sync
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pulls INBOX and Sent folders (90 days on first run, incremental after). Auto-sync runs every 15 min via cron.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void resetAndSync()}
                disabled={busy}
                title="Clears lastSyncAt, tests IMAP connection, then runs a full 90-day re-scan"
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${busy && phase !== "Syncing emails…" ? "animate-spin" : ""}`} />
                {busy && phase !== "Syncing emails…" ? (phase || "Working…") : "Reset & Re-sync"}
              </button>
              <button
                onClick={() => void syncNow()}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${busy && phase === "Syncing emails…" ? "animate-spin" : ""}`} />
                {busy && phase === "Syncing emails…" ? "Syncing…" : "Sync Now"}
              </button>
            </div>
          </div>

          {/* Connection test result — shown after Reset & Re-sync runs the test step */}
          {connTest && (
            <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg mb-3 ${
              connTest.ok
                ? "bg-green-950/40 border border-green-800/40 text-green-300"
                : "bg-red-950/40 border border-red-800/40 text-red-300"
            }`}>
              {connTest.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                : <AlertCircle  className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <span className="font-mono break-all">{connTest.text}</span>
            </div>
          )}

          {/* Last sync timestamp */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
            <Clock className="w-3.5 h-3.5" />
            Last sync:{" "}
            {config.lastSyncAt
              ? new Date(config.lastSyncAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "never"}
          </div>

          {/* Last run result stats */}
          {syncResult && (
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Fetched"  value={syncResult.fetched}  color="gray"   hint="Messages pulled from IMAP" />
              <StatCard label="Matched"  value={syncResult.matched}  color="blue"   hint="Matched to a CRM contact" />
              <StatCard label="Saved"    value={syncResult.saved}    color="green"  hint="New emails saved to DB" />
              <StatCard label="Skipped"  value={syncResult.skipped}  color="gray"   hint="Already in DB (duplicates)" />
            </div>
          )}
          {syncResult && syncResult.errors.length > 0 && (
            <div className="mt-3 bg-red-950/40 border border-red-800/40 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-red-300 mb-1">Errors ({syncResult.errors.length})</p>
              {syncResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400 font-mono">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IMAP + SMTP config card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            Titan IMAP / SMTP Configuration
          </h3>
          {config && !editing && (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        {config && !editing ? (
          <div className="space-y-2 text-sm">
            <SectionLabel>IMAP (Incoming)</SectionLabel>
            <Row label="Host"    value={`${config.host}:${config.port}`} />
            <Row label="Email"   value={config.emailAddress} />
            <SectionLabel>SMTP (Outgoing)</SectionLabel>
            <Row label="Host"    value={`${config.smtpHost}:${config.smtpPort}`} />
            <Row label="Email"   value={config.emailAddress} />
            <SectionLabel>Status</SectionLabel>
            <Row label="Sync"    value={config.enabled ? "Enabled" : "Disabled"} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* IMAP section */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">IMAP (Incoming — reads email)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">IMAP Host</label>
                  <input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">IMAP Port</label>
                  <input type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>

            {/* SMTP section */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">SMTP (Outgoing — sends email)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">SMTP Host</label>
                  <input value={form.smtpHost} onChange={e => setForm(p => ({ ...p, smtpHost: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">SMTP Port</label>
                  <input type="number" value={form.smtpPort} onChange={e => setForm(p => ({ ...p, smtpPort: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>

            {/* Shared credentials */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Credentials (shared for IMAP and SMTP)</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Titan Email Address</label>
                  <input value={form.emailAddress} onChange={e => setForm(p => ({ ...p, emailAddress: e.target.value }))}
                    placeholder="will@getrelay.software"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 placeholder-gray-600" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Password {config && <span className="text-gray-600">(leave blank to keep existing)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder={config ? "••••••••" : "Titan email password"}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm text-white outline-none focus:border-indigo-500 placeholder-gray-600"
                    />
                    <button onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Encrypted with AES-256-GCM using IMAP_ENCRYPTION_KEY.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="imap-enabled" checked={form.enabled}
                    onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} className="rounded" />
                  <label htmlFor="imap-enabled" className="text-sm text-gray-300">Enable IMAP sync</label>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                <Check className="w-4 h-4" /> {saving ? "Saving…" : "Save Configuration"}
              </button>
              {config && (
                <button onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!config && (
        <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4">
          <p className="text-xs text-blue-300 font-medium mb-1">No configuration yet</p>
          <p className="text-xs text-blue-400">
            Enter your Titan email credentials above to enable CRM email sending via SMTP and automatic
            inbox/sent-folder sync every 15 minutes.
          </p>
        </div>
      )}

      <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4">
        <p className="text-xs text-blue-300 font-medium mb-1">Sync Schedule</p>
        <p className="text-xs text-blue-400">
          IMAP sync runs automatically every 15 minutes. Both the INBOX and Sent folders are synced.
          Configure the cron job in Vercel dashboard with path{" "}
          <code className="bg-blue-950 px-1 rounded">/api/cron/imap-sync</code>{" "}
          and schedule <code className="bg-blue-950 px-1 rounded">{"*/15 * * * *"}</code>.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, hint }: { label: string; value: number; color: "gray" | "blue" | "green"; hint: string }) {
  const colors = {
    gray:  "text-gray-200 bg-gray-800",
    blue:  "text-indigo-300 bg-indigo-900/40",
    green: "text-green-300 bg-green-900/40",
  }
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 text-center" title={hint}>
      <p className={`text-2xl font-bold mb-0.5 ${colors[color].split(" ")[0]}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest pt-2 pb-0.5">{children}</p>
  )
}

// ─── Guide Tab ────────────────────────────────────────────────────────────────

function GuideTab() {
  return (
    <div className="space-y-6">
      <GuideSection title="Step 1 — Configure Titan IMAP / SMTP">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Go to the <strong>IMAP / SMTP</strong> tab.</li>
          <li>Enter your Titan email credentials:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-400">
              <li>IMAP Host: <code className="bg-gray-800 px-1 rounded">imap.titan.email</code> · Port <code className="bg-gray-800 px-1 rounded">993</code></li>
              <li>SMTP Host: <code className="bg-gray-800 px-1 rounded">smtp.titan.email</code> · Port <code className="bg-gray-800 px-1 rounded">465</code></li>
              <li>Email: your Titan email address</li>
              <li>Password: your Titan email password</li>
            </ul>
          </li>
          <li>Click <strong>Save Configuration</strong>. An initial sync will start automatically.</li>
          <li>Add the cron job in Vercel (see Step 3 below).</li>
        </ol>
      </GuideSection>

      <GuideSection title="Step 2 — Enable Resend Inbound (optional — for crm@ alias)">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Log into your <strong>Resend dashboard</strong> at resend.com.</li>
          <li>Go to <strong>Settings → Inbound</strong> and enable inbound email for <code className="bg-gray-800 px-1.5 rounded">getrelay.software</code>.</li>
          <li>Set webhook URL to:
            <code className="block bg-gray-800 px-3 py-2 rounded-lg mt-1 text-indigo-300 break-all">
              https://app.getrelay.software/api/webhooks/crm-email
            </code>
          </li>
          <li>Add <code className="bg-gray-800 px-1 rounded">RESEND_INBOUND_SECRET</code> to your Vercel env vars.</li>
        </ol>
      </GuideSection>

      <GuideSection title="Step 3 — Set Up 15-Minute Cron Job (Vercel)">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>In your Vercel project, go to <strong>Settings → Cron Jobs</strong>.</li>
          <li>Add a cron job: path <code className="bg-gray-800 px-1 rounded">/api/cron/imap-sync</code> · schedule <code className="bg-gray-800 px-1 rounded">{"*/15 * * * *"}</code>.</li>
          <li>Set <code className="bg-gray-800 px-1 rounded">CRON_SECRET</code> in Vercel env vars.</li>
        </ol>
      </GuideSection>

      <GuideSection title="Required Environment Variables">
        <div className="bg-gray-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <EnvLine name="IMAP_ENCRYPTION_KEY"  desc="32+ char random string for encrypting credentials (openssl rand -base64 32)" />
          <EnvLine name="CRON_SECRET"           desc="Secret for authenticating cron job requests" />
          <EnvLine name="RESEND_API_KEY"        desc="Resend API key — used for all non-CRM transactional emails" />
          <EnvLine name="RESEND_INBOUND_SECRET" desc="Optional — only needed for crm@ inbound webhook" />
        </div>
      </GuideSection>

      <div className="flex items-center gap-2 text-xs text-indigo-400">
        <ExternalLink className="w-3.5 h-3.5" />
        <a href="https://help.titan.email/hc/en-us/articles/900000002426" target="_blank" rel="noopener noreferrer"
          className="hover:underline">
          Titan Email IMAP/SMTP Settings
        </a>
      </div>
    </div>
  )
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  )
}

function EnvLine({ name, desc }: { name: string; desc: string }) {
  return (
    <div>
      <span className="text-indigo-300">{name}</span>
      <span className="text-gray-600">="..."</span>
      <span className="text-gray-500 ml-2 not-italic">— {desc}</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  )
}

// ─── Diagnostics Tab ──────────────────────────────────────────────────────────

function DiagnosticsTab() {
  const [testLogs,    setTestLogs]    = useState<string[]>([])
  const [syncLogs,    setSyncLogs]    = useState<string[]>([])
  const [testRunning, setTestRunning] = useState(false)
  const [syncRunning, setSyncRunning] = useState(false)

  async function runTest() {
    setTestRunning(true); setTestLogs([])
    try {
      const res  = await fetch("/api/super-admin/crm/test-imap")
      const data = await res.json() as { ok: boolean; steps: string[] }
      setTestLogs(data.steps)
    } catch (err) {
      setTestLogs([`Request failed: ${err instanceof Error ? err.message : String(err)}`])
    }
    setTestRunning(false)
  }

  async function runDebugSync() {
    setSyncRunning(true); setSyncLogs([])
    try {
      const res  = await fetch("/api/super-admin/crm/debug-sync", { method: "POST" })
      const data = await res.json() as { ok: boolean; synced?: number; skipped?: number; logs: string[] }
      setSyncLogs(data.logs)
    } catch (err) {
      setSyncLogs([`Request failed: ${err instanceof Error ? err.message : String(err)}`])
    }
    setSyncRunning(false)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400">
        Run these checks to diagnose why emails are not appearing in the CRM. All output is shown inline — nothing is hidden.
      </p>

      {/* IMAP connection test */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">IMAP Connection Test</h3>
            <p className="text-xs text-gray-500 mt-0.5">Checks config, decrypts password, connects, lists folders, shows recent message headers, counts DB records.</p>
          </div>
          <button
            onClick={runTest}
            disabled={testRunning}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testRunning ? "animate-spin" : ""}`} />
            {testRunning ? "Running…" : "Run Test"}
          </button>
        </div>
        {testLogs.length > 0 && (
          <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-green-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {testLogs.join("\n")}
          </pre>
        )}
      </div>

      {/* Debug sync */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Debug Sync (verbose)</h3>
            <p className="text-xs text-gray-500 mt-0.5">Runs a full IMAP sync and logs every message fetch, contact match, and DB save/skip attempt.</p>
          </div>
          <button
            onClick={runDebugSync}
            disabled={syncRunning}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncRunning ? "animate-spin" : ""}`} />
            {syncRunning ? "Syncing…" : "Run Debug Sync"}
          </button>
        </div>
        {syncLogs.length > 0 && (
          <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-green-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {syncLogs.join("\n")}
          </pre>
        )}
      </div>
    </div>
  )
}
