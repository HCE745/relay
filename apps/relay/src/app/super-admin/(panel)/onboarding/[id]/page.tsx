"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  ChevronLeft, Loader2, CheckSquare, Square, Save, Rocket, AlertTriangle,
  ExternalLink, CheckCircle2, Clock, Mail, UserCheck,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

type ChecklistItem = {
  key:             string
  label:           string
  completedAt:     string | null
  completedByName: string | null
}

type Onboarding = {
  id:                  string
  organizationId:      string
  status:              string
  primaryContactName:  string
  primaryContactEmail: string
  plan:                string
  estimatedFacilities: number
  internalNotes:       string | null
  ownerId:             string
  ownerName:           string
  checklist:           ChecklistItem[]
  trialStartDate:      string | null
  launchedAt:          string | null
  invitationSentAt:    string | null
  invitationToken:     string | null
  createdAt:           string
  updatedAt:           string
  organization: {
    id:                 string
    name:               string
    slug:               string
    plan:               string
    subscriptionStatus: string
    trialStartDate:     string | null
    trialEndsAt:        string | null
    createdAt:          string
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_ORDER = ["draft", "configuring", "ready_for_review", "ready_to_launch", "invitation_sent", "live"] as const
type OnboardingStatus = typeof STATUS_ORDER[number]

const STATUS_LABEL: Record<string, string> = {
  draft:            "Draft",
  configuring:      "Configuring",
  ready_for_review: "Ready for Review",
  ready_to_launch:  "Ready to Launch",
  invitation_sent:  "Invitation Sent",
  live:             "Live",
}

const STATUS_COLOR: Record<string, string> = {
  draft:            "bg-gray-800 text-gray-400 border-gray-700",
  configuring:      "bg-blue-900/50 text-blue-300 border-blue-700",
  ready_for_review: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  ready_to_launch:  "bg-indigo-900/50 text-indigo-300 border-indigo-700",
  invitation_sent:  "bg-purple-900/50 text-purple-300 border-purple-700",
  live:             "bg-green-900/50 text-green-300 border-green-700",
}

const PLAN_OPTIONS = ["essentials", "professional", "custom"]

// ── Component ──────────────────────────────────────────────────────────────

export default function OnboardingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData]           = useState<Onboarding | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [launching, setLaunching] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false)
  const [launchWarning, setLaunchWarning]         = useState<string[] | null>(null)
  const [forceLaunch, setForceLaunch]             = useState(false)

  // Editable form state
  const [form, setForm] = useState({
    primaryContactName:  "",
    primaryContactEmail: "",
    plan:                "essentials",
    estimatedFacilities: "1",
    internalNotes:       "",
    trialStartDate:      "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${id}`)
      if (!res.ok) throw new Error("Not found")
      const json = await res.json() as Onboarding
      setData(json)
      setForm({
        primaryContactName:  json.primaryContactName,
        primaryContactEmail: json.primaryContactEmail,
        plan:                json.plan,
        estimatedFacilities: String(json.estimatedFacilities),
        internalNotes:       json.internalNotes ?? "",
        trialStartDate:      json.trialStartDate
          ? json.trialStartDate.split("T")[0]
          : "",
      })
    } catch {
      setError("Failed to load onboarding record")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function patch(payload: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Save failed")
      }
      const updated = await res.json() as Onboarding
      setData(updated)
      setSuccess("Saved")
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDetails() {
    await patch({
      primaryContactName:  form.primaryContactName.trim(),
      primaryContactEmail: form.primaryContactEmail.trim().toLowerCase(),
      plan:                form.plan,
      estimatedFacilities: parseInt(form.estimatedFacilities, 10) || 1,
      internalNotes:       form.internalNotes.trim() || null,
      trialStartDate:      form.trialStartDate || null,
    })
  }

  async function handleStatusChange(newStatus: string) {
    await patch({ status: newStatus })
  }

  async function handleChecklistToggle(key: string, completed: boolean) {
    await patch({ checklistToggle: { key, completed } })
  }

  async function handleResendInvitation() {
    setResending(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${id}/resend-invitation`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      })
      const json = await res.json() as { ok?: boolean; error?: string; freshInvitation?: boolean }
      if (!res.ok) throw new Error(json.error ?? "Resend failed")
      await load()
      setSuccess(json.freshInvitation ? "Fresh invitation sent (previous was expired)." : "Invitation resent.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resend failed")
    } finally {
      setResending(false)
    }
  }

  async function handleMarkLive() {
    await patch({ status: "live" })
    if (!error) setSuccess("Customer marked as live.")
  }

  async function handleLaunch(force = false) {
    setLaunching(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${id}/launch`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ force }),
      })
      const json = await res.json() as {
        ok?: boolean
        error?: string
        incomplete?: string[]
        canForce?: boolean
      }
      if (res.status === 422 && json.incomplete) {
        // Checklist warning — offer force
        setLaunchWarning(json.incomplete)
        setForceLaunch(true)
        return
      }
      if (!res.ok) throw new Error(json.error ?? "Launch failed")
      setShowLaunchConfirm(false)
      setLaunchWarning(null)
      await load()
      setSuccess("Customer launched! Invitation email sent.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed")
    } finally {
      setLaunching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500">
        {error ?? "Onboarding record not found."}
      </div>
    )
  }

  const statusIdx         = STATUS_ORDER.indexOf(data.status as OnboardingStatus)
  const isLive            = data.status === "live"
  const isInvitationSent  = data.status === "invitation_sent"
  const canLaunch         = data.status === "ready_to_launch"
  const isReadOnly        = isLive || isInvitationSent
  // Only show pre-launch status transitions; invitation_sent→live is handled by Mark Live button
  const nextStatuses      = STATUS_ORDER.filter((s, i) =>
    !isLive && !isInvitationSent && i !== statusIdx && s !== "live" && s !== "invitation_sent"
  )
  const checklist = data.checklist as ChecklistItem[]
  const doneCt    = checklist.filter(i => i.completedAt).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/super-admin/onboarding" className="text-gray-500 hover:text-white mt-1 flex-shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white truncate">{data.organization.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border ${STATUS_COLOR[data.status] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Created {format(new Date(data.createdAt), "MMM d, yyyy")} · Owner: {data.ownerName}
          </p>
        </div>
        <Link
          href={`/super-admin/organizations/${data.organizationId}`}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Org
        </Link>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-950/40 border border-red-900/50 rounded-lg text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2 bg-green-950/40 border border-green-900/50 rounded-lg text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Status progression (only pre-launch stages) */}
      {!isLive && !isInvitationSent && nextStatuses.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Status</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map(s => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-indigo-500 hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
              >
                → {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Checklist */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Checklist</h2>
          <span className="text-xs text-gray-500">{doneCt}/{checklist.length} complete</span>
        </div>
        <div className="space-y-2">
          {checklist.map(item => {
            const done = !!item.completedAt
            return (
              <div key={item.key} className="flex items-start gap-3">
                <button
                  onClick={() => !isReadOnly && handleChecklistToggle(item.key, !done)}
                  disabled={saving || isReadOnly}
                  className="mt-0.5 flex-shrink-0 text-gray-500 hover:text-indigo-400 disabled:cursor-default transition-colors"
                >
                  {done ? (
                    <CheckSquare className="w-4 h-4 text-green-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <div className="min-w-0">
                  <span className={`text-sm ${done ? "text-gray-500 line-through" : "text-gray-200"}`}>
                    {item.label}
                  </span>
                  {done && item.completedByName && (
                    <span className="text-[11px] text-gray-600 ml-2">
                      {item.completedByName} · {format(new Date(item.completedAt!), "MMM d, h:mma")}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Details form */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
        <h2 className="text-sm font-semibold text-white mb-3">Details</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Name</label>
            <input
              value={form.primaryContactName}
              onChange={e => setForm(f => ({ ...f, primaryContactName: e.target.value }))}
              disabled={isReadOnly}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Email</label>
            <input
              type="email"
              value={form.primaryContactEmail}
              onChange={e => setForm(f => ({ ...f, primaryContactEmail: e.target.value }))}
              disabled={isReadOnly}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Plan</label>
            <select
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              disabled={isReadOnly}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              {PLAN_OPTIONS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Est. Facilities</label>
            <input
              type="number"
              min={1}
              value={form.estimatedFacilities}
              onChange={e => setForm(f => ({ ...f, estimatedFacilities: e.target.value }))}
              disabled={isReadOnly}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Trial Start Date</label>
            <input
              type="date"
              value={form.trialStartDate}
              onChange={e => setForm(f => ({ ...f, trialStartDate: e.target.value }))}
              disabled={isReadOnly}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Internal Notes</label>
          <textarea
            value={form.internalNotes}
            onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))}
            disabled={isReadOnly}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        {!isReadOnly && (
          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Details
          </button>
        )}
      </section>

      {/* Invitation / Launch */}
      {isLive ? (
        <section className="bg-gray-900 border border-green-900/50 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-semibold text-green-300">Live</h2>
          </div>
          {data.invitationSentAt && (
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Clock className="w-3.5 h-3.5" />
              Invitation sent to {data.primaryContactEmail}
            </div>
          )}
          {data.organization.trialEndsAt && (
            <p className="text-xs text-gray-500">
              Trial ends {format(new Date(data.organization.trialEndsAt), "MMM d, yyyy")}
            </p>
          )}
        </section>
      ) : isInvitationSent ? (
        <section className="bg-gray-900 border border-purple-800/60 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-purple-300">Invitation Sent</h2>
          </div>
          <p className="text-xs text-gray-400 mb-1">
            Waiting for <strong className="text-gray-200">{data.primaryContactEmail}</strong> to set up their account.
          </p>
          {data.invitationSentAt && (
            <p className="text-xs text-gray-500 mb-3">
              Last sent {format(new Date(data.invitationSentAt), "MMM d, yyyy 'at' h:mma")}
            </p>
          )}
          {data.organization.trialEndsAt && (
            <p className="text-xs text-gray-500 mb-4">
              Trial ends {format(new Date(data.organization.trialEndsAt), "MMM d, yyyy")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleResendInvitation}
              disabled={resending}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Resend Invitation
            </button>
            <button
              onClick={handleMarkLive}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
              Mark as Live
            </button>
          </div>
        </section>
      ) : canLaunch ? (
        <section className="bg-gray-900 border border-indigo-800/60 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Ready to Launch</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Launching will activate the trial, create an admin invitation for{" "}
            <strong className="text-gray-300">{data.primaryContactEmail}</strong>,
            and send the welcome email. This cannot be undone.
          </p>
          {!form.trialStartDate && (
            <p className="text-xs text-yellow-400 mb-3">
              ⚠ Set a trial start date above before launching.
            </p>
          )}
          <button
            onClick={() => setShowLaunchConfirm(true)}
            disabled={!form.trialStartDate || launching}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
          >
            {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
            Launch Customer
          </button>
        </section>
      ) : null}

      {/* Launch confirmation dialog */}
      {showLaunchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-2">Launch {data.organization.name}?</h3>
            {launchWarning && launchWarning.length > 0 && (
              <div className="mb-3 bg-yellow-950/40 border border-yellow-900/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-yellow-400 mb-2">Incomplete checklist items:</p>
                <ul className="text-xs text-yellow-300 space-y-0.5">
                  {launchWarning.map(w => <li key={w}>• {w}</li>)}
                </ul>
                <p className="text-xs text-gray-500 mt-2">You can still launch, but these items are marked incomplete.</p>
              </div>
            )}
            <p className="text-sm text-gray-400 mb-4">
              This will:
              <br />• Activate a {data.plan} trial for {form.trialStartDate ? format(new Date(form.trialStartDate), "MMM d, yyyy") : "today"}
              <br />• Send a setup invitation to <strong className="text-gray-200">{data.primaryContactEmail}</strong>
              <br />• Set org subscription to <strong className="text-gray-200">trialing</strong>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowLaunchConfirm(false); setLaunchWarning(null); setForceLaunch(false) }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLaunch(forceLaunch)}
                disabled={launching}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
              >
                {launching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {launchWarning ? "Launch Anyway" : "Confirm Launch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
