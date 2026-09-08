"use client"

import { useState } from "react"
import { Key, Webhook, Shield, Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check, ExternalLink, Link2, RefreshCw, LogOut } from "lucide-react"
import { format } from "date-fns"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string; name: string; keyPrefix: string; isActive: boolean
  lastUsedAt: string | null; expiresAt: string | null; createdAt: string
}

interface WebhookEndpoint {
  id: string; name: string; url: string; events: string[]
  isActive: boolean; deliveryCount: number; createdAt: string
}

interface SSOConfig {
  providerType: string; clientId: string | null; tenantIdOrDomain: string | null
  ssoEnabled: boolean; status: string
}

interface ConnectedAccountInfo {
  email: string
  lastSyncAt: string | null
  locationCount: number
}

interface SyncResult {
  locationsChecked: number
  reviewsNew: number
  reviewsClassified: number
  errors: string[]
}

const ALL_EVENTS = [
  { value: "issue_created",    label: "Issue Created" },
  { value: "issue_resolved",   label: "Issue Resolved" },
  { value: "issue_escalated",  label: "Issue Escalated" },
  { value: "injury_reported",  label: "Injury Reported" },
  { value: "purchase_approved",label: "Purchase Approved" },
  { value: "suggestion_created",label:"Suggestion Created" },
]

const SSO_PROVIDERS = [
  { value: "google_workspace",  label: "Google Workspace" },
  { value: "microsoft_entra",   label: "Microsoft Entra ID" },
  { value: "okta",              label: "Okta" },
  { value: "saml",              label: "SAML 2.0" },
  { value: "other",             label: "Other" },
]

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// ── API Keys Section ──────────────────────────────────────────────────────────

function ApiKeysSection({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  async function generate() {
    if (!name.trim()) { setError("Name required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/integrations/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed"); return }
      const j = await res.json() as { key: string; prefix: string }
      setNewKey(j.key)
      setKeys(ks => [{ id: "new", name, keyPrefix: j.prefix, isActive: true, lastUsedAt: null, expiresAt: null, createdAt: new Date().toISOString() }, ...ks])
      setShowForm(false); setName("")
    } finally { setSaving(false) }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? It cannot be recovered.")) return
    await fetch(`/api/integrations/api-keys/${id}`, { method: "DELETE" })
    setKeys(ks => ks.filter(k => k.id !== id))
  }

  function copy() {
    if (newKey) { navigator.clipboard.writeText(newKey).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <SectionHeader icon={Key} title="API Keys" description="Generate keys to authenticate programmatic access to the Relay API. Keys are shown only once — store them securely." />

      {newKey && (
        <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-green-900 mb-2">API key generated — copy it now. It won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-green-300 rounded px-3 py-2 font-mono text-green-900 break-all">{newKey}</code>
            <button onClick={copy} className="shrink-0 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-green-700 hover:underline">Dismiss</button>
        </div>
      )}

      {showForm ? (
        <div className="mb-5 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Key name, e.g. Production Integration"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={generate} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
              {saving ? "…" : "Generate"}
            </button>
            <button onClick={() => { setShowForm(false); setError("") }} className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="mb-5 flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Generate API Key
        </button>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No API keys yet</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {keys.map(k => (
            <div key={k.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{k.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{k.keyPrefix}…</p>
              </div>
              <div className="text-xs text-gray-400 shrink-0">
                {k.lastUsedAt ? `Last used ${format(new Date(k.lastUsedAt), "MMM d")}` : "Never used"}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${k.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {k.isActive ? "Active" : "Revoked"}
              </span>
              {k.isActive && (
                <button onClick={() => revoke(k.id)} className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors" title="Revoke">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <strong>TODO:</strong> Full REST API documentation and rate limiting will be added here. API keys are functional for authentication — endpoint documentation is coming.
      </div>
    </div>
  )
}

// ── Webhooks Section ──────────────────────────────────────────────────────────

function WebhooksSection({ initialEndpoints }: { initialEndpoints: WebhookEndpoint[] }) {
  const [endpoints, setEndpoints] = useState(initialEndpoints)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [error, setError] = useState("")

  function toggleEvent(e: string) {
    setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])
  }

  async function submit() {
    if (!name.trim() || !url.trim() || events.length === 0) { setError("All fields required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, url, events }),
      })
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed"); return }
      const j = await res.json() as { endpoint: WebhookEndpoint; secret: string }
      setEndpoints(es => [{ ...j.endpoint, deliveryCount: 0, createdAt: new Date().toISOString() }, ...es])
      setNewSecret(j.secret)
      setShowForm(false); setName(""); setUrl(""); setEvents([])
    } finally { setSaving(false) }
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/integrations/webhooks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive }),
    })
    setEndpoints(es => es.map(e => e.id === id ? { ...e, isActive } : e))
  }

  async function del(id: string) {
    if (!confirm("Delete this webhook endpoint?")) return
    await fetch(`/api/integrations/webhooks/${id}`, { method: "DELETE" })
    setEndpoints(es => es.filter(e => e.id !== id))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <SectionHeader icon={Webhook} title="Webhook Endpoints" description="Register HTTPS endpoints to receive real-time event notifications. Payloads are HMAC-signed with your endpoint secret." />

      {newSecret && (
        <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-green-900 mb-2">Webhook secret — copy now. It won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-green-300 rounded px-3 py-2 font-mono text-green-900 break-all">{newSecret}</code>
            <button onClick={() => { navigator.clipboard.writeText(newSecret).catch(() => {}); setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000) }} className="shrink-0 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors">
              {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSecret ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="mt-2 text-xs text-green-700 hover:underline">Dismiss</button>
        </div>
      )}

      {showForm ? (
        <div className="mb-5 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Endpoint name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-server.com/webhooks/relay" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Events to receive</p>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map(ev => (
                <button key={ev.value} onClick={() => toggleEvent(ev.value)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${events.includes(ev.value) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>
                  {ev.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">{saving ? "Saving…" : "Add Endpoint"}</button>
            <button onClick={() => { setShowForm(false); setError("") }} className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="mb-5 flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Endpoint
        </button>
      )}

      {endpoints.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No webhook endpoints yet</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {endpoints.map(ep => (
            <div key={ep.id} className="py-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{ep.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ep.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {ep.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{ep.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ep.events.map(e => (
                      <span key={e} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium">{e}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{ep.deliveryCount} deliveries</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggle(ep.id, !ep.isActive)} className={`p-1.5 rounded transition-colors ${ep.isActive ? "text-green-500 hover:text-green-700" : "text-gray-300 hover:text-gray-500"}`}>
                    {ep.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => del(ep.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zapier/Make placeholder */}
      <div className="mt-5 p-4 border border-dashed border-gray-300 rounded-xl">
        <div className="flex items-center gap-3">
          <ExternalLink className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-600">Zapier &amp; Make integrations</p>
            <p className="text-xs text-gray-400 mt-0.5">Native Zapier and Make.com integrations coming soon. Use webhooks above in the meantime.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Connected Accounts Section ────────────────────────────────────────────────

function ConnectedAccountsSection({ initialAccount }: { initialAccount: ConnectedAccountInfo | null }) {
  const [account, setAccount] = useState<ConnectedAccountInfo | null>(initialAccount)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState("")
  const [disconnecting, setDisconnecting] = useState(false)

  async function sync() {
    setSyncing(true); setSyncResult(null); setSyncError("")
    try {
      const res = await fetch("/api/integrations/google/sync", { method: "POST" })
      if (!res.ok) { setSyncError("Sync failed — check your connection"); return }
      const j = await res.json() as SyncResult
      setSyncResult(j)
      setAccount(a => a ? { ...a, lastSyncAt: new Date().toISOString() } : a)
    } catch { setSyncError("Network error") }
    finally { setSyncing(false) }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Business Profile? Review syncing will stop.")) return
    setDisconnecting(true)
    try {
      const res = await fetch("/api/integrations/google", { method: "DELETE" })
      if (res.ok) { setAccount(null); setSyncResult(null) }
    } finally { setDisconnecting(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <SectionHeader icon={Link2} title="Connected Accounts" description="Connect external services to power Relay features like Customer Voice review sync." />

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          {/* Google icon */}
          <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Google Business Profile</p>
            {account ? (
              <div className="mt-0.5 space-y-0.5">
                <p className="text-xs text-gray-500">{account.email}</p>
                <p className="text-xs text-gray-400">
                  {account.locationCount > 0 ? `${account.locationCount} location${account.locationCount === 1 ? "" : "s"}` : "No locations synced yet"}
                  {account.lastSyncAt ? ` · Last synced ${format(new Date(account.lastSyncAt), "MMM d 'at' h:mm a")}` : " · Never synced"}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Not connected</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {account ? (
              <>
                <button
                  onClick={sync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:border-gray-400 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing…" : "Sync Now"}
                </button>
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:border-red-400 disabled:opacity-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </>
            ) : (
              <a
                href="/api/integrations/google/connect"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:border-blue-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect
              </a>
            )}
          </div>
        </div>

        {syncResult && (
          <div className="border-t border-gray-100 bg-green-50 px-4 py-3">
            <p className="text-xs font-medium text-green-800">
              Sync complete — {syncResult.reviewsNew} new review{syncResult.reviewsNew === 1 ? "" : "s"} ingested
              across {syncResult.locationsChecked} location{syncResult.locationsChecked === 1 ? "" : "s"}
              {syncResult.reviewsClassified > 0 ? `, ${syncResult.reviewsClassified} classified by AI` : ""}.
            </p>
            {syncResult.errors.length > 0 && (
              <p className="text-xs text-amber-700 mt-1">{syncResult.errors.length} error{syncResult.errors.length === 1 ? "" : "s"}: {syncResult.errors.join("; ")}</p>
            )}
          </div>
        )}

        {syncError && (
          <div className="border-t border-gray-100 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-700">{syncError}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SSO Section ───────────────────────────────────────────────────────────────

function SSOSection({ initialConfig }: { initialConfig: SSOConfig | null }) {
  const [config, setConfig] = useState<SSOConfig>(initialConfig ?? {
    providerType: "google_workspace",
    clientId: null, tenantIdOrDomain: null,
    ssoEnabled: false, status: "not_configured",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/integrations/sso", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerType: config.providerType, clientId: config.clientId, tenantIdOrDomain: config.tenantIdOrDomain }),
      })
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed"); return }
      const j = await res.json() as { config: SSOConfig }
      setConfig(j.config)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const statusColor = {
    not_configured: "bg-gray-100 text-gray-600",
    pending: "bg-amber-100 text-amber-700",
    active: "bg-green-100 text-green-700",
  }[config.status] ?? "bg-gray-100 text-gray-600"

  const statusLabel = { not_configured: "Not Configured", pending: "Pending", active: "Active" }[config.status] ?? config.status

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <SectionHeader icon={Shield} title="Single Sign-On (SSO)" description="Configure your identity provider to allow users to sign in with their existing company credentials." />

      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
          {config.status !== "active" && (
            <span className="text-xs text-gray-400">SSO toggle will be enabled once configuration is verified.</span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Identity Provider</label>
          <select value={config.providerType} onChange={e => setConfig(c => ({ ...c, providerType: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {SSO_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
          <input value={config.clientId ?? ""} onChange={e => setConfig(c => ({ ...c, clientId: e.target.value || null }))} placeholder="Your OAuth Client ID" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID / Domain</label>
          <input value={config.tenantIdOrDomain ?? ""} onChange={e => setConfig(c => ({ ...c, tenantIdOrDomain: e.target.value || null }))} placeholder="e.g. your-company.com or tenant UUID" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex items-center gap-3">
          <button disabled={true} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-400 text-sm rounded-lg cursor-not-allowed">
            SSO Enabled: Off
          </button>
          <span className="text-xs text-gray-400">SSO activation requires Relay support to verify your configuration.</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? "Saving…" : saved ? "Saved!" : "Save Configuration"}
        </button>
      </div>

      <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <strong>TODO:</strong> Full SAML/OAuth SSO authentication flow will be wired here. Current implementation stores your configuration and is ready for the authentication implementation.
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function IntegrationsClient({
  apiWebhooksEnabled,
  ssoEnabled,
  connectedAccount,
  initialApiKeys,
  initialWebhooks,
  initialSSOConfig,
}: {
  apiWebhooksEnabled: boolean
  ssoEnabled: boolean
  connectedAccount: ConnectedAccountInfo | null
  initialApiKeys: ApiKey[]
  initialWebhooks: WebhookEndpoint[]
  initialSSOConfig: SSOConfig | null
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <ConnectedAccountsSection initialAccount={connectedAccount} />
      {apiWebhooksEnabled && <ApiKeysSection initialKeys={initialApiKeys} />}
      {apiWebhooksEnabled && <WebhooksSection initialEndpoints={initialWebhooks} />}
      {ssoEnabled && <SSOSection initialConfig={initialSSOConfig} />}
    </div>
  )
}
