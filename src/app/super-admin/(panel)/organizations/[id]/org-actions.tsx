"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogIn, Loader2, ChevronDown, Edit2, ShieldOff, ShieldCheck, RotateCcw, Clock, X, Check, Sparkles } from "lucide-react"

interface OrgData {
  id: string
  name: string
  slug: string
  plan: string
  subscriptionStatus: string
  suspendedAt: string | null
  trialEndsAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  employeeLimit: number | null
  locationLimit: number | null
  onboardingCompleted: boolean
  aiSuggestionsAvailable: boolean
}

interface Props {
  org: OrgData
  adminUserId: string | null
  adminUserName: string | null
}

const PLANS = ["free", "starter", "pro", "enterprise"]
const BILLING_STATUSES = ["trialing", "active", "past_due", "canceled", "suspended"]
const TRIAL_DAYS_OPTIONS = [7, 14, 30, 60, 90]

export function OrgActions({ org, adminUserId, adminUserName }: Props) {
  const router = useRouter()
  const [editOpen,  setEditOpen]  = useState(false)
  const [trialOpen, setTrialOpen] = useState(false)
  const [loading,   setLoading]   = useState<string | null>(null)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState("")

  // Edit form state
  const [name,               setName]               = useState(org.name)
  const [plan,               setPlan]               = useState(org.plan)
  const [billingStatus,      setBillingStatus]      = useState(org.subscriptionStatus)
  const [trialEndsAt,        setTrialEndsAt]        = useState(org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : "")
  const [stripeSubId,        setStripeSubId]        = useState(org.stripeSubscriptionId ?? "")
  const [employeeLimit,      setEmployeeLimit]      = useState(org.employeeLimit != null ? String(org.employeeLimit) : "")
  const [locationLimit,      setLocationLimit]      = useState(org.locationLimit != null ? String(org.locationLimit) : "")
  const [extendDays,         setExtendDays]         = useState(14)

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(""), 3500)
  }

  async function patchOrg(body: Record<string, unknown>, label: string) {
    setLoading(label)
    setError("")
    try {
      const res  = await fetch(`/api/super-admin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Failed"); return false }
      router.refresh()
      return true
    } finally {
      setLoading(null)
    }
  }

  async function patchTrial(action: string, days?: number) {
    setLoading(`trial-${action}`)
    setError("")
    try {
      const res  = await fetch(`/api/super-admin/organizations/${org.id}/trial`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, days }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Failed"); return }
      setTrialOpen(false)
      flash(`Trial ${action === "activate" ? "marked active" : action + "ed"}`)
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleSaveEdit() {
    const body: Record<string, unknown> = {}
    if (name !== org.name)                              body.name               = name
    if (plan !== org.plan)                              body.plan               = plan
    if (billingStatus !== org.subscriptionStatus)       body.subscriptionStatus = billingStatus
    if (trialEndsAt !== (org.trialEndsAt?.slice(0, 10) ?? "")) {
      body.trialEndsAt = trialEndsAt ? new Date(trialEndsAt).toISOString() : null
    }
    if (stripeSubId !== (org.stripeSubscriptionId ?? "")) body.stripeSubscriptionId = stripeSubId || null
    const empLimitVal = employeeLimit === "" ? null : Number(employeeLimit)
    const locLimitVal = locationLimit === "" ? null : Number(locationLimit)
    if (empLimitVal !== (org.employeeLimit ?? null)) body.employeeLimit = empLimitVal
    if (locLimitVal !== (org.locationLimit ?? null)) body.locationLimit = locLimitVal

    if (Object.keys(body).length === 0) { setEditOpen(false); return }
    const ok = await patchOrg(body, "save-edit")
    if (ok) { flash("Saved"); setEditOpen(false) }
  }

  async function impersonate() {
    if (!adminUserId) return
    setLoading("impersonate")
    setError("")
    try {
      const res  = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: org.id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Failed"); return }
      window.location.href = "/dashboard"
    } finally {
      setLoading(null)
    }
  }

  const isSuspended = !!org.suspendedAt

  return (
    <div className="flex flex-col gap-3 items-end">
      {error   && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-green-400 text-xs">{success}</p>}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {/* Edit */}
        <button
          onClick={() => { setEditOpen((v) => !v); setTrialOpen(false) }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${editOpen ? "bg-indigo-600 text-white border-indigo-500" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-indigo-600 hover:text-white"}`}
        >
          {editOpen ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          {editOpen ? "Cancel" : "Edit Org"}
        </button>

        {/* Trial dropdown */}
        <div className="relative">
          <button
            onClick={() => { setTrialOpen((v) => !v); setEditOpen(false) }}
            className="flex items-center gap-2 px-3 py-2 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800 text-amber-300 text-sm font-medium rounded-lg transition-colors"
          >
            <Clock className="w-4 h-4" />
            Trial
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {trialOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-4">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Trial Management</p>
              <div className="mb-3">
                <label className="block text-gray-500 text-xs mb-1">Extend by days</label>
                <div className="flex gap-2">
                  <input type="number" min={1} max={365} value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value))}
                    className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  <button onClick={() => patchTrial("extend", extendDays)} disabled={!!loading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg">
                    {loading === "trial-extend" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
                  </button>
                </div>
              </div>
              {[
                { action: "reset",    label: "Reset to 14 days",     cls: "text-gray-300 hover:bg-gray-700" },
                { action: "end",      label: "End trial now",         cls: "text-red-400 hover:bg-red-950/60" },
                { action: "activate", label: "Mark as Active (paid)", cls: "text-green-400 hover:bg-green-950/60" },
              ].map(({ action, label, cls }) => (
                <button key={action} onClick={() => patchTrial(action)} disabled={!!loading}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 disabled:opacity-50 ${cls}`}>
                  {loading === `trial-${action}` ? "…" : label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Suggestions toggle */}
        <button
          onClick={async () => {
            const ok = await patchOrg({ aiSuggestionsAvailable: !org.aiSuggestionsAvailable }, "ai-toggle")
            if (ok) flash(`AI Suggestions ${org.aiSuggestionsAvailable ? "disabled" : "enabled"}`)
          }}
          disabled={!!loading}
          title={org.aiSuggestionsAvailable ? "Disable AI Suggestions for this org" : "Enable AI Suggestions for this org"}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border ${
            org.aiSuggestionsAvailable
              ? "bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border-purple-800"
              : "bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-700 hover:text-purple-300 hover:border-purple-800"
          }`}
        >
          {loading === "ai-toggle" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          AI {org.aiSuggestionsAvailable ? "On" : "Off"}
        </button>

        {/* Suspend / Reactivate */}
        <button
          onClick={() => patchOrg({ suspend: !isSuspended }, "suspend")}
          disabled={!!loading}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${isSuspended
            ? "bg-green-950/60 hover:bg-green-900/60 text-green-400 border border-green-900"
            : "bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-900"}`}
        >
          {loading === "suspend" ? <Loader2 className="w-4 h-4 animate-spin" /> : isSuspended ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
          {isSuspended ? "Reactivate" : "Suspend"}
        </button>

        {/* Reset onboarding */}
        <button
          onClick={async () => { await patchOrg({ resetOnboarding: true }, "onboarding"); flash("Onboarding reset") }}
          disabled={!!loading || !org.onboardingCompleted}
          title={!org.onboardingCompleted ? "Already incomplete" : "Reset onboarding to incomplete"}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
        >
          {loading === "onboarding" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Reset Onboarding
        </button>

        {/* Impersonate */}
        <button onClick={impersonate} disabled={!adminUserId || !!loading}
          title={!adminUserId ? "No admin found" : `Login as ${adminUserName}`}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium rounded-lg transition-colors">
          {loading === "impersonate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Login as Admin
        </button>
      </div>

      {/* Inline edit form */}
      {editOpen && (
        <div className="w-full bg-gray-900 border border-gray-700 rounded-xl p-5 mt-1">
          <h3 className="text-white font-semibold text-sm mb-4">Edit Organization</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Organization name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Plan</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Billing status</label>
              <select value={billingStatus} onChange={(e) => setBillingStatus(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                {BILLING_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trial end date</label>
              <input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stripe Subscription ID</label>
              <input value={stripeSubId} onChange={(e) => setStripeSubId(e.target.value)}
                placeholder="sub_…"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Employee limit</label>
                <input type="number" min={0} value={employeeLimit}
                  onChange={(e) => setEmployeeLimit(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Location limit</label>
                <input type="number" min={0} value={locationLimit}
                  onChange={(e) => setLocationLimit(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4 justify-end">
            <button onClick={() => setEditOpen(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveEdit} disabled={loading === "save-edit"}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white text-sm font-semibold rounded-lg transition-colors">
              {loading === "save-edit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
