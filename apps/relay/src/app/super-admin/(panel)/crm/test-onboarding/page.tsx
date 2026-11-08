"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FlaskConical, ExternalLink, RefreshCw, Trash2, Play, Loader2,
  AlertTriangle, CheckCircle, Clock, UserPlus, Globe,
} from "lucide-react"

interface TestOrg {
  id: string
  name: string
  slug: string
  createdAt: string
  crmProspectId: string | null
  onboardingSession: { currentStage: string | null; completedAt: string | null; updatedAt: string } | null
  users: Array<{ id: string; name: string; email: string }>
}

function relativeDate(d: string): string {
  const diffMs   = Date.now() - new Date(d).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 60)              return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24)               return `${diffHrs}h ago`
  return `${Math.floor(diffHrs / 24)}d ago`
}

function StatusBadge({ org }: { org: TestOrg }) {
  const s = org.onboardingSession
  if (!s) return <span className="text-xs text-gray-600 italic">No session</span>
  if (s.completedAt) return <span className="text-xs font-medium text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">Completed</span>
  if (s.currentStage) return <span className="text-xs font-medium text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full capitalize">{s.currentStage.replace(/_/g, " ")}</span>
  return <span className="text-xs font-medium text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Not started</span>
}

export default function TestOnboardingPage() {
  // ── Create-new-org form ───────────────────────────────────────────────────
  const [form, setForm] = useState({ companyName: "", adminName: "", adminEmail: "" })
  const [creating, setCreating]           = useState(false)
  const [createError, setCreateError]     = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // ── Public signup token flow ───────────────────────────────────────────────
  const [tokenState, setTokenState] = useState<"idle" | "generating" | "ready">("idle")
  const [tokenExpiry, setTokenExpiry]   = useState<string | null>(null)
  const [tokenError, setTokenError]     = useState<string | null>(null)

  // ── Test org list ─────────────────────────────────────────────────────────
  const [testOrgs, setTestOrgs]       = useState<TestOrg[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [orgsError, setOrgsError]     = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [resumingId, setResumingId]   = useState<string | null>(null)

  const loadOrgs = useCallback(async () => {
    setLoadingOrgs(true)
    setOrgsError(null)
    try {
      const res  = await fetch("/api/super-admin/crm/test-mode")
      const json = await res.json() as { testOrgs?: TestOrg[]; error?: string }
      if (!res.ok) { setOrgsError(json.error ?? "Failed to load test orgs"); return }
      setTestOrgs(json.testOrgs ?? [])
    } catch (err) {
      setOrgsError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoadingOrgs(false)
    }
  }, [])

  useEffect(() => { void loadOrgs() }, [loadOrgs])

  // ── Create a new test org and enter onboarding ────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      const res  = await fetch("/api/super-admin/crm/test-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json() as { onboardingUrl?: string; error?: string; message?: string }
      if (!res.ok) { setCreateError(json.error ?? "Failed to create test org"); return }
      setCreateSuccess(json.message ?? "Test org created")
      void loadOrgs()
      // Navigate into the onboarding wizard immediately
      window.location.href = json.onboardingUrl ?? "/onboarding"
    } catch (err) {
      setCreateError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCreating(false)
    }
  }

  // ── Generate test registration token ──────────────────────────────────────
  async function generateToken() {
    setTokenState("generating")
    setTokenError(null)
    try {
      const res  = await fetch("/api/super-admin/crm/test-mode/registration-token", { method: "POST" })
      const json = await res.json() as { ok?: boolean; expiresAt?: string; error?: string }
      if (!res.ok) { setTokenError(json.error ?? "Failed to generate token"); setTokenState("idle"); return }
      setTokenExpiry(json.expiresAt ?? null)
      setTokenState("ready")
    } catch (err) {
      setTokenError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
      setTokenState("idle")
    }
  }

  async function clearToken() {
    await fetch("/api/super-admin/crm/test-mode/registration-token", { method: "DELETE" })
    setTokenState("idle")
    setTokenExpiry(null)
  }

  function openSignup() {
    window.open("/register", "_blank", "noopener")
  }

  // ── Resume test org session ───────────────────────────────────────────────
  async function handleResume(orgId: string) {
    setResumingId(orgId)
    try {
      const res  = await fetch("/api/super-admin/crm/test-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeOrgId: orgId }),
      })
      const json = await res.json() as { onboardingUrl?: string; error?: string }
      if (!res.ok) { alert(json.error ?? "Failed to resume"); return }
      window.location.href = json.onboardingUrl ?? "/onboarding"
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setResumingId(null)
    }
  }

  // ── Delete test org ───────────────────────────────────────────────────────
  async function handleDelete(org: TestOrg) {
    if (!confirm(`Delete test org "${org.name}" and all its data? This cannot be undone.`)) return
    setDeletingId(org.id)
    try {
      const res  = await fetch(`/api/super-admin/crm/test-mode?orgId=${org.id}`, { method: "DELETE" })
      const json = await res.json() as { error?: string }
      if (!res.ok) { alert(json.error ?? "Delete failed"); return }
      setTestOrgs(prev => prev.filter(o => o.id !== org.id))
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <FlaskConical className="w-6 h-6 text-violet-400" />
          Test Onboarding
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Test the full onboarding and registration experience without touching live data, CRM sync, or round-robin assignment.
        </p>
      </div>

      {/* ── Flow 1: Create test org + enter onboarding ── */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Test Onboarding Wizard</h2>
          <span className="text-[10px] font-semibold uppercase tracking-widest bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded-full ml-1">
            Impersonation
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Creates an isolated test org, then enters the real onboarding wizard as its admin. The
          amber impersonation banner will appear; click <strong className="text-gray-400">Exit</strong> to return here.
          Test org email must include <code className="text-gray-400">+test</code> or end with{" "}
          <code className="text-gray-400">@example.com</code>.
        </p>

        <form onSubmit={(e) => { void handleCreate(e) }} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Company Name</label>
              <input
                type="text"
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="Acme Cleaners"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Admin Name</label>
              <input
                type="text"
                value={form.adminName}
                onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))}
                placeholder="Jane Smith"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Admin Email</label>
            <input
              type="email"
              value={form.adminEmail}
              onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
              placeholder="jane+test@example.com"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {createError && (
            <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {createError}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Create & Launch Onboarding
          </button>
        </form>
      </section>

      {/* ── Flow 2: Test public signup ── */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Test Public Signup</h2>
          <span className="text-[10px] font-semibold uppercase tracking-widest bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full ml-1">
            Real Flow
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Generates a short-lived HMAC-signed cookie that authorizes a single test registration through the real <code className="text-gray-400">/register</code> page.
          The registration API detects the cookie server-side and sets <code className="text-gray-400">isDemo=true</code> on the new org, bypassing CRM sync, welcome email, and round-robin assignment.
        </p>

        {tokenError && (
          <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {tokenError}
          </div>
        )}

        {tokenState === "ready" && tokenExpiry && (
          <div className="flex items-start gap-2 p-3 bg-emerald-900/20 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs">
            <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              Token active — expires at <strong>{new Date(tokenExpiry).toLocaleTimeString()}</strong>.
              Open the signup page (opens in new tab) and register within the window.
              The token is consumed on first use.
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tokenState !== "ready" ? (
            <button
              onClick={() => void generateToken()}
              disabled={tokenState === "generating"}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {tokenState === "generating"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Clock className="w-4 h-4" />}
              Generate Test Token
            </button>
          ) : (
            <>
              <button
                onClick={openSignup}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open /register
              </button>
              <button
                onClick={() => void clearToken()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
              >
                Clear Token
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Existing test orgs ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Existing Test Orgs</h2>
          <button
            onClick={() => void loadOrgs()}
            disabled={loadingOrgs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingOrgs ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>

        {orgsError && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-xs">{orgsError}</div>
        )}

        {loadingOrgs ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
          </div>
        ) : testOrgs.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No test orgs yet. Create one above.
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Org</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {testOrgs.map(org => (
                  <tr key={org.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-white text-xs">{org.name}</span>
                        {org.users[0] && (
                          <span className="text-[11px] text-gray-500">{org.users[0].email}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge org={org} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {relativeDate(org.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void handleResume(org.id)}
                          disabled={resumingId === org.id}
                          title="Resume — re-enter this test org"
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          {resumingId === org.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Play className="w-3 h-3" />}
                          Resume
                        </button>
                        <button
                          onClick={() => void handleDelete(org)}
                          disabled={deletingId === org.id}
                          title="Delete this test org and all its data"
                          className="flex items-center gap-1 p-1.5 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deletingId === org.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-gray-600">
        Test orgs are created with <code className="text-gray-500">isDemo=true</code>. They never enter live round-robin assignment, customer reporting, or real sales follow-ups. Delete them here when done.
      </p>
    </div>
  )
}
