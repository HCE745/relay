"use client"

import { useState, useEffect } from "react"
import {
  Settings, Mail, Server, BookOpen, Plus, Pencil, Trash2, Check,
  X, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Clock, CheckCircle2, AlertCircle, ListOrdered, Sliders,
} from "lucide-react"

type Tab = "templates" | "imap" | "sequences" | "global" | "guide" | "debug"

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
          { key: "sequences", label: "Sequences",        icon: ListOrdered },
          { key: "global",    label: "Global Settings",  icon: Sliders },
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
      {tab === "sequences" && <SequencesTab />}
      {tab === "global"    && <GlobalSettingsTab />}
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

function ImapTab() {
  const [config,       setConfig]       = useState<ImapConfig | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [editing,      setEditing]      = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ text: string; ok: boolean } | null>(null)
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
    const d = await res.json() as { config?: ImapConfig; error?: string }
    if (!res.ok) { setError(d.error ?? "Save failed"); setSaving(false); return }
    setEditing(false)
    setSaving(false)
    setSaveMsg({ text: "Configuration saved. Run npm run imap-sync to pull emails.", ok: true })
    void load()
  }

  if (loading) return <p className="text-sm text-gray-500 py-4">Loading…</p>

  return (
    <div className="space-y-5">
      {/* Save status banner */}
      {saveMsg && (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm border ${
          saveMsg.ok
            ? "bg-green-950/40 border-green-800/40 text-green-300"
            : "bg-red-950/40 border-red-800/40 text-red-300"
        }`}>
          {saveMsg.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          {saveMsg.text}
        </div>
      )}

      {/* Local sync notice */}
      {config && (
        <div className="bg-amber-950/30 border border-amber-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-200 flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-amber-400" />
            IMAP Sync — Run Locally
          </h3>
          <p className="text-xs text-amber-300/80 mb-3">
            Titan email blocks requests from Vercel&apos;s server IPs. Run the sync from your local machine instead — it reads from the same production database.
          </p>

          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mb-1">Run once now</p>
              <code className="block bg-black/40 border border-amber-800/40 text-amber-100 text-xs font-mono px-3 py-2 rounded-lg">
                npm run imap-sync
              </code>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mb-1">Force full 90-day re-scan</p>
              <code className="block bg-black/40 border border-amber-800/40 text-amber-100 text-xs font-mono px-3 py-2 rounded-lg">
                npm run imap-sync -- --full
              </code>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mb-1">Auto-run every 15 min (add to crontab)</p>
              <code className="block bg-black/40 border border-amber-800/40 text-amber-100 text-xs font-mono px-3 py-2 rounded-lg break-all">
                {"*/15 * * * * cd ~/relay && npm run imap-sync >> /tmp/imap-sync.log 2>&1"}
              </code>
              <p className="text-[10px] text-amber-600 mt-1">Edit with: <span className="font-mono">crontab -e</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-600 mt-4 pt-3 border-t border-amber-800/30">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Last sync:{" "}
            {config.lastSyncAt
              ? new Date(config.lastSyncAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "never"}
          </div>
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
        <p className="text-xs text-blue-300 font-medium mb-1">How sync works</p>
        <p className="text-xs text-blue-400">
          The sync script reads IMAP credentials from the database, fetches INBOX and Sent folders,
          auto-creates CRM contacts for unknown inbound senders, and writes emails directly to the
          production database. Run it locally — not via Vercel.
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

      <GuideSection title="Step 3 — Set Up Automatic Sync (Local Cron)">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Open your crontab: <code className="bg-gray-800 px-1.5 rounded">crontab -e</code></li>
          <li>Add this line (adjust the path to your relay directory):
            <code className="block bg-gray-800 px-3 py-2 rounded-lg mt-1 text-indigo-300 break-all font-mono text-xs">
              {"*/15 * * * * cd ~/relay && npm run imap-sync >> /tmp/imap-sync.log 2>&1"}
            </code>
          </li>
          <li>Save and exit. The sync will run every 15 minutes while your machine is on.</li>
          <li>Check the log anytime: <code className="bg-gray-800 px-1.5 rounded">tail -f /tmp/imap-sync.log</code></li>
        </ol>
        <p className="text-xs text-gray-500 mt-3">
          Titan email blocks requests from Vercel&apos;s IP addresses, so the sync must run locally.
          The script reads from and writes to the same production database as the app.
        </p>
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

// ─── Sequences Tab ────────────────────────────────────────────────────────────

interface SequenceStep {
  id?:                string
  stepNumber:         number
  delayBusinessDays:  number
  subjectBehavior:    "same" | "re" | "new"
  newSubject:         string | null
  messageTemplate:    string
  aiInstructions:     string
  requireApproval:    boolean
  autoSendAllowed:    boolean
}

interface Sequence {
  id:           string
  name:         string
  description:  string | null
  isActive:     boolean
  isDefault:    boolean
  isSystem:     boolean
  stopOnReply:  boolean
  stopOnCustomer: boolean
  steps:        SequenceStep[]
}

function SequencesTab() {
  const [sequences,  setSequences]  = useState<Sequence[]>([])
  const [loading,    setLoading]    = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [creating,   setCreating]   = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState("")
  const [form,       setForm]       = useState<Omit<Sequence, "id" | "isSystem">>({
    name: "", description: "", isActive: true, isDefault: false,
    stopOnReply: true, stopOnCustomer: true, steps: [],
  })

  async function load() {
    setLoading(true)
    const r = await fetch("/api/super-admin/crm/sequences")
    const d = await r.json() as { sequences: Sequence[] }
    setSequences(d.sequences ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  function addStep() {
    const next = (form.steps.length > 0 ? Math.max(...form.steps.map(s => s.stepNumber)) : 0) + 1
    setForm(f => ({
      ...f,
      steps: [...f.steps, {
        stepNumber: next, delayBusinessDays: 3, subjectBehavior: "same",
        newSubject: null, messageTemplate: "", aiInstructions: "", requireApproval: true, autoSendAllowed: false,
      }],
    }))
  }

  function updateStep(idx: number, patch: Partial<SequenceStep>) {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }))
  }

  function removeStep(idx: number) {
    setForm(f => ({
      ...f,
      steps: f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 })),
    }))
  }

  function startCreate() {
    setForm({ name: "", description: "", isActive: true, isDefault: false, stopOnReply: true, stopOnCustomer: true, steps: [] })
    setEditingId(null); setCreating(true); setError("")
  }

  function startEdit(seq: Sequence) {
    setForm({ name: seq.name, description: seq.description ?? "", isActive: seq.isActive, isDefault: seq.isDefault, stopOnReply: seq.stopOnReply, stopOnCustomer: seq.stopOnCustomer, steps: seq.steps })
    setEditingId(seq.id); setCreating(false); setError("")
  }

  async function save() {
    if (!form.name) { setError("Name required"); return }
    setSaving(true); setError("")
    const method = editingId ? "PATCH" : "POST"
    const url    = editingId ? `/api/super-admin/crm/sequences/${editingId}` : "/api/super-admin/crm/sequences"
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    })
    setSaving(false)
    if (r.ok) { setCreating(false); setEditingId(null); await load() }
    else {
      const d = await r.json() as { error?: string }
      setError(d.error ?? "Save failed")
    }
  }

  async function toggle(seq: Sequence) {
    await fetch(`/api/super-admin/crm/sequences/${seq.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !seq.isActive }),
    })
    await load()
  }

  async function del(seq: Sequence) {
    if (!confirm(`Delete sequence "${seq.name}"? This cannot be undone.`)) return
    const r = await fetch(`/api/super-admin/crm/sequences/${seq.id}`, { method: "DELETE" })
    if (r.ok) await load()
    else {
      const d = await r.json() as { error?: string }
      setError(d.error ?? "Delete failed")
    }
  }

  if (loading) return <div className="text-gray-400 text-sm py-6">Loading sequences…</div>

  const isFormOpen = creating || !!editingId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Follow-Up Sequences</h2>
          <p className="text-gray-400 text-sm mt-0.5">Templates that define how many follow-ups to send and when.</p>
        </div>
        {!isFormOpen && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Sequence
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Create / Edit form */}
      {isFormOpen && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-5">
          <h3 className="font-semibold text-white">{editingId ? "Edit Sequence" : "New Sequence"}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. After Demo"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Description</label>
              <input
                type="text"
                value={form.description ?? ""}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            {([
              { key: "isActive",       label: "Active" },
              { key: "isDefault",      label: "Default for new emails" },
              { key: "stopOnReply",    label: "Stop on reply" },
              { key: "stopOnCustomer", label: "Stop when becomes customer" },
            ] as { key: keyof typeof form; label: string }[]).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">Steps ({form.steps.length})</h4>
              <button
                onClick={addStep}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>
            <div className="space-y-3">
              {form.steps.map((step, idx) => (
                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-300">Step {step.stepNumber}</span>
                    <button onClick={() => removeStep(idx)} className="text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Delay (business days)</label>
                      <input
                        type="number"
                        min={1}
                        value={step.delayBusinessDays}
                        onChange={e => updateStep(idx, { delayBusinessDays: parseInt(e.target.value) || 1 })}
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Subject</label>
                      <select
                        value={step.subjectBehavior}
                        onChange={e => updateStep(idx, { subjectBehavior: e.target.value as SequenceStep["subjectBehavior"] })}
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="same">Same as original</option>
                        <option value="re">Re: original</option>
                        <option value="new">New subject (specify)</option>
                      </select>
                    </div>
                  </div>
                  {step.subjectBehavior === "new" && (
                    <input
                      type="text"
                      value={step.newSubject ?? ""}
                      onChange={e => updateStep(idx, { newSubject: e.target.value })}
                      placeholder="New subject line"
                      className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  )}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">AI Instructions</label>
                    <textarea
                      value={step.aiInstructions}
                      onChange={e => updateStep(idx, { aiInstructions: e.target.value })}
                      rows={2}
                      placeholder="e.g. Acknowledge the previous email, share a relevant case study…"
                      className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={step.requireApproval}
                        onChange={e => updateStep(idx, { requireApproval: e.target.checked })}
                      />
                      <span className="text-xs text-gray-300">Require approval</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={step.autoSendAllowed}
                        onChange={e => updateStep(idx, { autoSendAllowed: e.target.checked })}
                      />
                      <span className="text-xs text-gray-300">Auto-send allowed</span>
                    </label>
                  </div>
                </div>
              ))}
              {form.steps.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No steps yet. Click "Add Step" to add the first one.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving…" : "Save Sequence"}
            </button>
            <button
              onClick={() => { setCreating(false); setEditingId(null); setError("") }}
              className="text-sm text-gray-400 hover:text-white px-3 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sequences list */}
      <div className="space-y-3">
        {sequences.map(seq => (
          <div key={seq.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-gray-800/50"
              onClick={() => setExpandedId(v => v === seq.id ? null : seq.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white">{seq.name}</span>
                  {seq.isDefault && (
                    <span className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-700/30 px-1.5 py-0.5 rounded">Default</span>
                  )}
                  {seq.isSystem && (
                    <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Built-in</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${seq.isActive ? "bg-green-900/40 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                    {seq.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {seq.description && <p className="text-xs text-gray-500 mt-0.5">{seq.description}</p>}
                <p className="text-xs text-gray-500 mt-1">{seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => toggle(seq)}
                  className="text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded hover:bg-gray-700 transition-colors"
                >
                  {seq.isActive ? "Deactivate" : "Activate"}
                </button>
                {!seq.isSystem && (
                  <>
                    <button
                      onClick={() => startEdit(seq)}
                      className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void del(seq)}
                      className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-gray-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {expandedId === seq.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {expandedId === seq.id && seq.steps.length > 0 && (
              <div className="border-t border-gray-800 px-5 py-4">
                <div className="space-y-2">
                  {seq.steps.map(step => (
                    <div key={step.stepNumber} className="flex items-start gap-4 text-sm">
                      <div className="w-6 h-6 rounded-full bg-indigo-900/50 border border-indigo-700/40 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs text-indigo-300 font-bold">{step.stepNumber}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-200">
                          +{step.delayBusinessDays} business day{step.delayBusinessDays !== 1 ? "s" : ""}
                          {step.subjectBehavior === "new" && step.newSubject ? ` · New subject: "${step.newSubject}"` : ""}
                        </p>
                        {step.aiInstructions && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{step.aiInstructions}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {sequences.length === 0 && !loading && (
          <p className="text-gray-500 text-sm text-center py-8">No sequences yet. Click "New Sequence" to create one.</p>
        )}
      </div>
    </div>
  )
}

// ─── Global Settings Tab ──────────────────────────────────────────────────────

interface CrmGlobalSettings {
  id:                  string
  timezone:            string
  sendingWindowStart:  number
  sendingWindowEnd:    number
  autoSendEnabled:     boolean
}

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney",
]

function GlobalSettingsTab() {
  const [settings, setSettings] = useState<CrmGlobalSettings | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState("")

  async function load() {
    setLoading(true)
    const r = await fetch("/api/super-admin/crm/settings")
    const d = await r.json() as { settings: CrmGlobalSettings }
    setSettings(d.settings)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function save() {
    if (!settings) return
    setSaving(true); setError(""); setSaved(false)
    const r = await fetch("/api/super-admin/crm/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone:           settings.timezone,
        sendingWindowStart: settings.sendingWindowStart,
        sendingWindowEnd:   settings.sendingWindowEnd,
        autoSendEnabled:    settings.autoSendEnabled,
      }),
    })
    setSaving(false)
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else {
      const d = await r.json() as { error?: string }
      setError(d.error ?? "Save failed")
    }
  }

  if (loading || !settings) return <div className="text-gray-400 text-sm py-6">Loading…</div>

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-white font-semibold">Global CRM Settings</h2>
        <p className="text-gray-400 text-sm mt-0.5">
          Controls follow-up scheduling and AI draft generation across all sequences.
        </p>
      </div>

      {/* Timezone */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">CRM Timezone</label>
        <select
          value={settings.timezone}
          onChange={e => setSettings(s => s ? { ...s, timezone: e.target.value } : s)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Follow-up scheduling uses this timezone. AI drafts generate at 8am in this timezone.
        </p>
      </div>

      {/* Sending window */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Sending Window</label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Start (local hour)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={settings.sendingWindowStart}
              onChange={e => setSettings(s => s ? { ...s, sendingWindowStart: parseInt(e.target.value) || 9 } : s)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-gray-500 mt-5">→</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">End (local hour)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={settings.sendingWindowEnd}
              onChange={e => setSettings(s => s ? { ...s, sendingWindowEnd: parseInt(e.target.value) || 16 } : s)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Follow-ups are scheduled within this window (default 9–16 = 9am–4pm).
        </p>
      </div>

      {/* Auto-send */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Auto-Send Mode</h3>
            <p className="text-xs text-gray-400 mt-1">
              When enabled, approved follow-ups are sent automatically without manual review.
              <strong className="text-yellow-400"> Use with caution.</strong> Default: off (Review Before Send).
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={settings.autoSendEnabled}
              onChange={e => setSettings(s => s ? { ...s, autoSendEnabled: e.target.checked } : s)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
          </label>
        </div>
        {settings.autoSendEnabled && (
          <div className="mt-3 flex items-start gap-2 text-yellow-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">Auto-send is ON. Follow-ups will be sent without your approval. Monitor the queue regularly.</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {saved ? <CheckCircle2 className="w-4 h-4 text-green-300" /> : <Check className="w-4 h-4" />}
        {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  )
}
