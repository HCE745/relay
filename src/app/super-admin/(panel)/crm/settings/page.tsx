"use client"

import { useState, useEffect } from "react"
import {
  Settings, Mail, Server, BookOpen, Plus, Pencil, Trash2, Check,
  X, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react"

type Tab = "templates" | "imap" | "guide"

interface Template {
  id:       string
  name:     string
  subject:  string
  body:     string
  isSystem: boolean
}

interface ImapConfig {
  host:         string
  port:         number
  emailAddress: string
  lastSyncAt:   string | null
  enabled:      boolean
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
          { key: "imap",      label: "IMAP / Titan Sync", icon: Server },
          { key: "guide",     label: "Setup Guide",    icon: BookOpen },
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

      {/* Create / Edit form */}
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

      {/* Template list */}
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

// ─── IMAP Tab ─────────────────────────────────────────────────────────────────

function ImapTab() {
  const [config,       setConfig]       = useState<ImapConfig | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [editing,      setEditing]      = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [syncing,      setSyncing]      = useState(false)
  const [syncMsg,      setSyncMsg]      = useState("")
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState("")
  const [form, setForm] = useState({
    host: "imap.titan.email", port: 993, emailAddress: "", password: "", enabled: true,
  })

  async function load() {
    setLoading(true)
    const r = await fetch("/api/super-admin/crm/imap-config")
    const d = await r.json() as { config: ImapConfig | null }
    setConfig(d.config)
    if (d.config) {
      setForm(p => ({ ...p, host: d.config!.host, port: d.config!.port, emailAddress: d.config!.emailAddress, enabled: d.config!.enabled }))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save() {
    if (!form.emailAddress) { setError("Email address required"); return }
    if (!config && !form.password) { setError("Password required for new configuration"); return }
    setSaving(true); setError("")
    const res = await fetch("/api/super-admin/crm/imap-config", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, password: form.password || undefined }),
    })
    if (!res.ok) { const d = await res.json() as { error: string }; setError(d.error); setSaving(false); return }
    setEditing(false); void load(); setSaving(false)
  }

  async function syncNow() {
    setSyncing(true); setSyncMsg("")
    const res  = await fetch("/api/super-admin/crm/imap-sync", { method: "POST" })
    const data = await res.json() as { result?: { synced: number; errors: string[] }; error?: string }
    setSyncMsg(data.error ?? (data.result ? `Synced ${data.result.synced} new email(s).` : "Done."))
    setSyncing(false)
  }

  if (loading) return <p className="text-sm text-gray-500 py-4">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            Titan IMAP Configuration
          </h3>
          {config && !editing && (
            <div className="flex items-center gap-2">
              <button onClick={syncNow} disabled={syncing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-40">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
          )}
        </div>

        {syncMsg && <p className="text-xs text-green-400 mb-3">{syncMsg}</p>}

        {config && !editing ? (
          <div className="space-y-2 text-sm">
            <Row label="Host"         value={config.host} />
            <Row label="Port"         value={String(config.port)} />
            <Row label="Email"        value={config.emailAddress} />
            <Row label="Status"       value={config.enabled ? "Enabled" : "Disabled"} />
            <Row label="Last synced"  value={config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : "Never"} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">IMAP Host</label>
                <input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Port</label>
                <input type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: Number(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
            </div>
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
              <input type="checkbox" id="imap-enabled" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
                className="rounded" />
              <label htmlFor="imap-enabled" className="text-sm text-gray-300">Enable IMAP sync</label>
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

      <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4">
        <p className="text-xs text-blue-300 font-medium mb-1">Sync Schedule</p>
        <p className="text-xs text-blue-400">
          IMAP sync runs automatically every 15 minutes via the cron job at{" "}
          <code className="bg-blue-950 px-1 rounded">/api/cron/imap-sync</code>.
          Configure it in your Vercel dashboard with <code className="bg-blue-950 px-1 rounded">{"*/15 * * * *"}</code> schedule.
          You can also trigger a manual sync using the "Sync Now" button above.
        </p>
      </div>
    </div>
  )
}

// ─── Guide Tab ────────────────────────────────────────────────────────────────

function GuideTab() {
  return (
    <div className="space-y-6">
      <GuideSection title="Step 1 — Enable Resend Inbound Email">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Log into your <strong>Resend dashboard</strong> at resend.com.</li>
          <li>Go to <strong>Settings → Inbound</strong>.</li>
          <li>Enable inbound email for the domain <code className="bg-gray-800 px-1.5 rounded">getrelay.software</code>.</li>
          <li>Set the webhook URL to:<br />
            <code className="block bg-gray-800 px-3 py-2 rounded-lg mt-1 text-indigo-300 break-all">
              https://app.getrelay.software/api/webhooks/crm-email
            </code>
          </li>
          <li>Copy the inbound signing secret and add it to your env as <code className="bg-gray-800 px-1 rounded">RESEND_INBOUND_SECRET</code>.</li>
        </ol>
      </GuideSection>

      <GuideSection title="Step 2 — Configure MX Records in Bluehost">
        <p className="text-sm text-gray-300 mb-3">
          For <code className="bg-gray-800 px-1.5 rounded">crm@getrelay.software</code> to receive email via Resend inbound, add these MX records in Bluehost:
        </p>
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Type</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Value</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 text-gray-300">
              <tr><td className="px-4 py-2">MX</td><td className="px-4 py-2">crm</td><td className="px-4 py-2">inbound-smtp.resend.com</td><td className="px-4 py-2">10</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          DNS propagation takes up to 48 hours. After setting the MX record, test by sending an email to crm@getrelay.software.
        </p>
      </GuideSection>

      <GuideSection title="Step 3 — Configure Titan IMAP">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Go to the <strong>IMAP / Titan Sync</strong> tab in this settings page.</li>
          <li>Enter your Titan email credentials:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-400">
              <li>Host: <code className="bg-gray-800 px-1 rounded">imap.titan.email</code></li>
              <li>Port: <code className="bg-gray-800 px-1 rounded">993</code> (TLS)</li>
              <li>Email: your Titan email address</li>
              <li>Password: your Titan email password</li>
            </ul>
          </li>
          <li>Save. The first sync will run immediately, pulling the last 30 days of email.</li>
          <li>Add the cron job in Vercel dashboard (see below).</li>
        </ol>
      </GuideSection>

      <GuideSection title="Step 4 — Set Up 15-Minute Cron Job (Vercel)">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>In your Vercel project, go to <strong>Settings → Cron Jobs</strong>.</li>
          <li>Add a new cron job:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-400">
              <li>Path: <code className="bg-gray-800 px-1 rounded">/api/cron/imap-sync</code></li>
              <li>Schedule: <code className="bg-gray-800 px-1 rounded">{"*/15 * * * *"}</code></li>
            </ul>
          </li>
          <li>Set the <code className="bg-gray-800 px-1 rounded">CRON_SECRET</code> environment variable in Vercel and make sure it matches your local env.</li>
        </ol>
      </GuideSection>

      <GuideSection title="Required Environment Variables">
        <div className="bg-gray-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <EnvLine name="RESEND_INBOUND_SECRET" desc="Signing secret from Resend inbound settings" />
          <EnvLine name="IMAP_ENCRYPTION_KEY"  desc="32+ char random string to encrypt IMAP passwords (generate with: openssl rand -base64 32)" />
          <EnvLine name="CRON_SECRET"           desc="Secret for authenticating cron job requests" />
          <EnvLine name="RESEND_API_KEY"        desc="Resend API key (already set)" />
        </div>
      </GuideSection>

      <div className="flex items-center gap-2 text-xs text-indigo-400">
        <ExternalLink className="w-3.5 h-3.5" />
        <a href="https://resend.com/docs/dashboard/domains/inbound" target="_blank" rel="noopener noreferrer"
          className="hover:underline">
          Resend Inbound Email Documentation
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
      <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  )
}
