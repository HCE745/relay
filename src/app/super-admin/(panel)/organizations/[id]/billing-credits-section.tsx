"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, Plus, Loader2, ChevronDown, ChevronUp, Zap, XCircle, CheckCircle } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

type CreditType      = "percentage_off" | "fixed_amount" | "free_billing_cycles" | "free_addon" | "free_intelligence_module" | "free_employee_band" | "free_location"
type CreditAppliesTo = "entire_invoice" | "base_subscription" | "addons_only" | "specific_addon" | "specific_module"
type CreditStatus    = "pending" | "scheduled" | "active" | "completed" | "cancelled" | "expired"
type SchedulingType  = "immediate" | "specific_date" | "after_months_active" | "after_referral_qualification" | "after_trial_conversion"
type DurationType    = "one_invoice" | "x_billing_cycles" | "until_date" | "until_cancelled"

interface BillingCredit {
  id:                        string
  creditType:                CreditType
  appliesTo:                 CreditAppliesTo
  appliesToDetail?:          string | null
  discountValue:             number
  description:               string
  internalNotes?:            string | null
  status:                    CreditStatus
  schedulingType:            SchedulingType
  scheduledStartDate?:       string | null
  scheduledStartAfterMonths?: number | null
  durationType:              DurationType
  durationCycles?:           number | null
  durationUntilDate?:        string | null
  effectiveDate?:            string | null
  completionDate?:           string | null
  stripeCouponId?:           string | null
  reason?:                   string | null
  createdAt:                 string
}

interface Props {
  orgId:            string
  initialCredits:   BillingCredit[]
}

const STATUS_COLORS: Record<CreditStatus, string> = {
  active:    "bg-green-900/40 text-green-300 border-green-800/40",
  scheduled: "bg-blue-900/40 text-blue-300 border-blue-800/40",
  pending:   "bg-yellow-900/40 text-yellow-300 border-yellow-800/40",
  completed: "bg-gray-800 text-gray-400 border-gray-700",
  cancelled: "bg-gray-800 text-gray-400 border-gray-700",
  expired:   "bg-red-900/20 text-red-400 border-red-800/40",
}

const CREDIT_TYPE_LABELS: Record<CreditType, string> = {
  percentage_off:           "% Off",
  fixed_amount:             "Fixed $/mo Off",
  free_billing_cycles:      "Free Billing Cycles",
  free_addon:               "Free Add-on",
  free_intelligence_module: "Free Intelligence Module",
  free_employee_band:       "Free Employee Band",
  free_location:            "Free Location",
}

const APPLIES_TO_LABELS: Record<CreditAppliesTo, string> = {
  entire_invoice:   "Entire invoice",
  base_subscription: "Base subscription",
  addons_only:      "Add-ons only",
  specific_addon:   "Specific add-on",
  specific_module:  "Specific module",
}

function describeCredit(type: CreditType, value: number): string {
  switch (type) {
    case "percentage_off":           return `${value}% off`
    case "fixed_amount":             return `$${value}/mo off`
    case "free_billing_cycles":      return `${value} free cycle${value !== 1 ? "s" : ""}`
    case "free_addon":               return "Free add-on"
    case "free_intelligence_module": return "Free module"
    case "free_employee_band":       return "Free band"
    case "free_location":            return "Free location"
  }
}

function describeDuration(type: DurationType, cycles?: number | null, until?: string | null): string {
  switch (type) {
    case "one_invoice":      return "One invoice"
    case "x_billing_cycles": return `${cycles ?? "?"} cycle${(cycles ?? 0) !== 1 ? "s" : ""}`
    case "until_date":       return until ? `Until ${format(new Date(until), "MMM d, yyyy")}` : "Until date"
    case "until_cancelled":  return "Until cancelled"
  }
}

const ACTIVE_STATUSES: CreditStatus[] = ["active", "scheduled", "pending"]
const HISTORY_STATUSES: CreditStatus[] = ["completed", "cancelled", "expired"]

export function BillingCreditsSection({ orgId, initialCredits }: Props) {
  const router = useRouter()
  const [credits, setCredits]   = useState<BillingCredit[]>(initialCredits)
  const [tab, setTab]           = useState<"active" | "history">("active")
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [acting, setActing]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")

  const displayed = credits.filter(c =>
    tab === "active" ? ACTIVE_STATUSES.includes(c.status) : HISTORY_STATUSES.includes(c.status)
  )

  // Form
  const defaultForm = {
    creditType:                "percentage_off" as CreditType,
    appliesTo:                 "entire_invoice" as CreditAppliesTo,
    appliesToDetail:           "",
    discountValue:             "",
    description:               "",
    internalNotes:             "",
    schedulingType:            "immediate" as SchedulingType,
    scheduledStartDate:        "",
    scheduledStartAfterMonths: "",
    durationType:              "until_cancelled" as DurationType,
    durationCycles:            "",
    durationUntilDate:         "",
    reason:                    "",
  }
  const [form, setForm] = useState(defaultForm)
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  const needsDetail = form.appliesTo === "specific_addon" || form.appliesTo === "specific_module"

  async function createCredit() {
    if (!form.discountValue || !form.description || saving) return
    setSaving(true); setError("")
    try {
      const body: Record<string, unknown> = {
        creditType:    form.creditType,
        appliesTo:     form.appliesTo,
        discountValue: parseFloat(form.discountValue),
        description:   form.description.trim(),
        schedulingType: form.schedulingType,
        durationType:  form.durationType,
      }
      if (form.appliesToDetail.trim())           body.appliesToDetail = form.appliesToDetail.trim()
      if (form.internalNotes.trim())             body.internalNotes   = form.internalNotes.trim()
      if (form.scheduledStartDate)               body.scheduledStartDate = form.scheduledStartDate
      if (form.scheduledStartAfterMonths)        body.scheduledStartAfterMonths = parseInt(form.scheduledStartAfterMonths)
      if (form.durationCycles)                   body.durationCycles  = parseInt(form.durationCycles)
      if (form.durationUntilDate)                body.durationUntilDate = form.durationUntilDate
      if (form.reason.trim())                    body.reason          = form.reason.trim()

      const res  = await fetch(`/api/super-admin/organizations/${orgId}/billing-credits`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      })
      const json = await res.json() as BillingCredit & { error?: string }
      if (!res.ok) { setError(json.error ?? "Failed"); return }
      setCredits([json, ...credits])
      setShowForm(false); setForm(defaultForm)
      router.refresh()
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  async function doAction(credit: BillingCredit, action: "activate" | "cancel" | "complete") {
    if (action === "cancel" && !confirm(`Cancel "${credit.description}"?`)) return
    setActing(credit.id)
    try {
      const res  = await fetch(`/api/super-admin/organizations/${orgId}/billing-credits/${credit.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json() as BillingCredit
      if (res.ok) setCredits(credits.map(c => c.id === credit.id ? json : c))
      router.refresh()
    } finally { setActing(null) }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Billing Credits</h2>
          {credits.filter(c => c.status === "active").length > 0 && (
            <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full border border-green-800/40">
              {credits.filter(c => c.status === "active").length} active
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError("") }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Credit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {(["active", "history"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors capitalize ${
              tab === t ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "active" ? "Active & Scheduled" : "History"}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-5 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3">
          <p className="text-xs font-semibold text-gray-300">New Billing Credit</p>

          <div className="grid grid-cols-2 gap-3">
            {/* Credit Type */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Credit Type</label>
              <select value={form.creditType} onChange={e => setF("creditType", e.target.value as CreditType)}
                className="w-full px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {(Object.entries(CREDIT_TYPE_LABELS) as [CreditType, string][]).map(([v, l]) =>
                  <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Discount Value */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Value
                {form.creditType === "percentage_off" ? " (%)" :
                 form.creditType === "fixed_amount" ? " ($)" :
                 form.creditType === "free_billing_cycles" ? " (cycles)" : ""}
              </label>
              <input type="number" min="0" step="any" value={form.discountValue}
                onChange={e => setF("discountValue", e.target.value)}
                placeholder="e.g. 20" className="w-full px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* Applies To */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Applies To</label>
              <select value={form.appliesTo} onChange={e => setF("appliesTo", e.target.value as CreditAppliesTo)}
                className="w-full px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {(Object.entries(APPLIES_TO_LABELS) as [CreditAppliesTo, string][]).map(([v, l]) =>
                  <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Applies To Detail */}
            {needsDetail && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Specific {form.appliesTo === "specific_addon" ? "Add-on" : "Module"}</label>
                <input value={form.appliesToDetail} onChange={e => setF("appliesToDetail", e.target.value)}
                  placeholder="e.g. issue_intelligence" className="w-full px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}

            {/* Description */}
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Customer-facing Description</label>
              <input value={form.description} onChange={e => setF("description", e.target.value)}
                placeholder="Founding discount, Partner deal…" className="w-full px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* Scheduling */}
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1.5 block">Scheduling</label>
              <div className="flex flex-wrap gap-2">
                {(["immediate", "specific_date", "after_months_active", "after_referral_qualification", "after_trial_conversion"] as SchedulingType[]).map(s => (
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="scheduling" value={s} checked={form.schedulingType === s}
                      onChange={() => setF("schedulingType", s)} className="text-indigo-500" />
                    <span className="text-xs text-gray-300 capitalize">{s.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
              {form.schedulingType === "specific_date" && (
                <div className="mt-2">
                  <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                  <input type="datetime-local" value={form.scheduledStartDate} onChange={e => setF("scheduledStartDate", e.target.value)}
                    className="px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
              {form.schedulingType === "after_months_active" && (
                <div className="mt-2">
                  <label className="text-xs text-gray-400 mb-1 block">Months Active Required</label>
                  <input type="number" min="1" value={form.scheduledStartAfterMonths} onChange={e => setF("scheduledStartAfterMonths", e.target.value)}
                    placeholder="e.g. 3" className="w-24 px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1.5 block">Duration</label>
              <div className="flex flex-wrap gap-2">
                {(["one_invoice", "x_billing_cycles", "until_date", "until_cancelled"] as DurationType[]).map(d => (
                  <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="duration" value={d} checked={form.durationType === d}
                      onChange={() => setF("durationType", d)} className="text-indigo-500" />
                    <span className="text-xs text-gray-300 capitalize">{d.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
              {form.durationType === "x_billing_cycles" && (
                <div className="mt-2">
                  <label className="text-xs text-gray-400 mb-1 block">Number of Cycles</label>
                  <input type="number" min="1" value={form.durationCycles} onChange={e => setF("durationCycles", e.target.value)}
                    placeholder="e.g. 3" className="w-24 px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
              {form.durationType === "until_date" && (
                <div className="mt-2">
                  <label className="text-xs text-gray-400 mb-1 block">End Date</label>
                  <input type="date" value={form.durationUntilDate} onChange={e => setF("durationUntilDate", e.target.value)}
                    className="px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </div>

            {/* Internal Notes + Reason */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Internal Notes</label>
              <input value={form.internalNotes} onChange={e => setF("internalNotes", e.target.value)}
                placeholder="Context, deal terms…" className="w-full px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Reason</label>
              <input value={form.reason} onChange={e => setF("reason", e.target.value)}
                placeholder="Why this credit?" className="w-full px-2.5 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Preview */}
          {form.discountValue && form.creditType && (
            <p className="text-xs text-indigo-300 bg-indigo-900/20 border border-indigo-800/40 rounded px-2.5 py-1.5">
              <strong>{describeCredit(form.creditType, parseFloat(form.discountValue) || 0)}</strong>
              {" · "}{describeDuration(form.durationType, parseInt(form.durationCycles) || null, form.durationUntilDate || null)}
              {" · "}<span className="capitalize">{form.schedulingType.replace(/_/g, " ")}</span>
            </p>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setShowForm(false); setError("") }}
              className="px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors">Cancel</button>
            <button onClick={createCredit} disabled={!form.description || !form.discountValue || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Credit
            </button>
          </div>
        </div>
      )}

      {/* Credits list */}
      {displayed.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">
          {tab === "active" ? "No active or scheduled credits." : "No credit history."}
        </p>
      ) : (
        <div className="space-y-2">
          {displayed.map(credit => (
            <div key={credit.id} className="rounded-lg border border-gray-700 overflow-hidden bg-gray-800">
              <div
                className="flex items-center justify-between px-3.5 py-3 cursor-pointer hover:bg-gray-750"
                onClick={() => setExpanded(expanded === credit.id ? null : credit.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[credit.status]}`}>
                    {credit.status}
                  </span>
                  <span className="text-sm text-white font-medium truncate">{credit.description}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-2">
                  <span className="text-xs text-indigo-300 font-medium">
                    {describeCredit(credit.creditType, credit.discountValue)}
                  </span>
                  {expanded === credit.id
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  }
                </div>
              </div>

              {expanded === credit.id && (
                <div className="px-3.5 pb-3.5 border-t border-gray-700 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-gray-500">Type</span>
                    <span className="text-gray-200">{CREDIT_TYPE_LABELS[credit.creditType]}</span>
                    <span className="text-gray-500">Applies To</span>
                    <span className="text-gray-200">
                      {APPLIES_TO_LABELS[credit.appliesTo]}
                      {credit.appliesToDetail && ` (${credit.appliesToDetail})`}
                    </span>
                    <span className="text-gray-500">Duration</span>
                    <span className="text-gray-200">{describeDuration(credit.durationType, credit.durationCycles, credit.durationUntilDate)}</span>
                    <span className="text-gray-500">Scheduling</span>
                    <span className="text-gray-200 capitalize">{credit.schedulingType.replace(/_/g, " ")}</span>
                    {credit.effectiveDate && <>
                      <span className="text-gray-500">Active Since</span>
                      <span className="text-gray-200">{format(new Date(credit.effectiveDate), "MMM d, yyyy")}</span>
                    </>}
                    {credit.completionDate && <>
                      <span className="text-gray-500">Ended</span>
                      <span className="text-gray-200">{format(new Date(credit.completionDate), "MMM d, yyyy")}</span>
                    </>}
                    {credit.stripeCouponId && <>
                      <span className="text-gray-500">Stripe Coupon</span>
                      <span className="text-gray-200 font-mono text-[10px]">{credit.stripeCouponId}</span>
                    </>}
                    {credit.reason && <>
                      <span className="text-gray-500">Reason</span>
                      <span className="text-gray-200">{credit.reason}</span>
                    </>}
                    <span className="text-gray-500">Created</span>
                    <span className="text-gray-200">{formatDistanceToNow(new Date(credit.createdAt), { addSuffix: true })}</span>
                  </div>

                  {credit.internalNotes && (
                    <p className="text-xs text-gray-400 italic bg-gray-700/40 px-2.5 py-1.5 rounded">{credit.internalNotes}</p>
                  )}

                  {/* Actions */}
                  {["active", "scheduled", "pending"].includes(credit.status) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {credit.status !== "active" && (
                        <button onClick={() => doAction(credit, "activate")} disabled={acting === credit.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                          {acting === credit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          Activate Now
                        </button>
                      )}
                      {credit.status === "active" && (
                        <button onClick={() => doAction(credit, "complete")} disabled={acting === credit.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                          {acting === credit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Mark Complete
                        </button>
                      )}
                      <button onClick={() => doAction(credit, "cancel")} disabled={acting === credit.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-900/40 hover:bg-red-800/60 disabled:opacity-40 text-red-300 text-xs font-semibold rounded-lg transition-colors border border-red-800/40">
                        {acting === credit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
