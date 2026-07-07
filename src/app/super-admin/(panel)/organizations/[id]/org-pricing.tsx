"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CreditCard, Edit2, X, Check, Loader2, AlertTriangle, Tag,
  ToggleLeft, ToggleRight, ExternalLink, Info,
} from "lucide-react"
import { calculatePrice, PLANS, PRO_EMPLOYEE_BANDS, PP_EMPLOYEE_BANDS } from "@/lib/pricing"
import type { PlanKey, ModuleId } from "@/lib/pricing"

const PLAN_OPTIONS = [
  { value: "essentials",        label: "Essentials ($149/mo)" },
  { value: "professional",      label: "Professional ($299/mo)" },
  { value: "professional_plus", label: "Professional Plus ($999/mo)" },
  { value: "enterprise",        label: "Enterprise (custom)" },
]

const STATUS_OPTIONS = [
  { value: "trialing",  label: "Trialing" },
  { value: "active",    label: "Active" },
  { value: "past_due",  label: "Past Due" },
  { value: "canceled",  label: "Canceled" },
  { value: "expired",   label: "Expired" },
  { value: "read_only", label: "Read-Only (expired mode)" },
  { value: "suspended", label: "Suspended" },
]

const INTELLIGENCE_MODULES = [
  { id: "issue_intelligence"    as ModuleId, label: "Issue Intelligence" },
  { id: "sop_intelligence"      as ModuleId, label: "SOP Intelligence" },
  { id: "asset_intelligence"    as ModuleId, label: "Asset Intelligence" },
  { id: "benchmark_intelligence"as ModuleId, label: "Benchmark Intelligence" },
  { id: "purchase_intelligence" as ModuleId, label: "Purchase Intelligence" },
]

const PLAN_KEYS = new Set(["essentials", "professional", "professional_plus"])

function bandLabel(plan: string, count: number): string {
  if (!PLAN_KEYS.has(plan)) return String(count)
  const bands = plan === "professional_plus" ? PP_EMPLOYEE_BANDS : PRO_EMPLOYEE_BANDS
  const band = bands.find(b => count >= b.min && (b.max === null || count <= b.max))
  return band ? band.label : String(count)
}

interface PricingData {
  orgId:               string
  plan:                string
  subscriptionStatus:  string
  billingFrequency:    string
  currentPrice:        number | null
  priceLockedUntil:    string | null
  intelligenceModules: string[]
  intelligenceSuiteEnabled: boolean
  companySize:         string | null
  numberOfLocations:   string | null
  employeeCount:       number | null
  locationCount:       number | null
  stripeCustomerId:    string | null
  stripeSubscriptionId: string | null
  // Calculated pricing
  monthlyBasePrice:           number | null
  monthlyScalingCost:         number | null
  monthlyModulesCost:         number | null
  monthlyTotalBeforeDiscount: number | null
  monthlyTotalAfterDiscount:  number | null
  // Discount
  discountPercent:   number | null
  discountExpiresAt: string | null
  discountLabel:     string | null
  // Checkout intent
  checkoutIntentStatus: string | null
}

interface ChangeItem { label: string; from: string; to: string }

function describeChanges(
  p: PricingData,
  { plan, empCount, locCount, modules, suite, discountPct, discountExpires, discountLabel, freq, price, locked }: {
    plan: string; empCount: string; locCount: string; modules: string[]; suite: boolean
    discountPct: string; discountExpires: string; discountLabel: string
    freq: string; price: string; locked: string
  }
): { changes: ChangeItem[]; newMonthly: number | null } {
  const changes: ChangeItem[] = []

  if (plan !== p.plan) {
    changes.push({
      label: "Plan",
      from: PLAN_OPTIONS.find(o => o.value === p.plan)?.label ?? p.plan,
      to:   PLAN_OPTIONS.find(o => o.value === plan)?.label ?? plan,
    })
  }

  const empNum = empCount ? Number(empCount) : null
  const locNum = locCount ? Number(locCount) : null
  const oldEmp = p.employeeCount
  const oldLoc = p.locationCount

  if (empNum !== null && empNum !== oldEmp) {
    changes.push({
      label: "Employee band",
      from: oldEmp != null ? bandLabel(p.plan, oldEmp) : "not set",
      to:   bandLabel(plan, empNum),
    })
  }
  if (locNum !== null && locNum !== oldLoc) {
    changes.push({
      label: "Locations",
      from: String(oldLoc ?? "not set"),
      to:   String(locNum),
    })
  }

  const sortedOldMods = [...p.intelligenceModules].sort().join(",")
  const sortedNewMods = [...modules].sort().join(",")
  if (suite !== p.intelligenceSuiteEnabled) {
    changes.push({ label: "Intelligence Suite", from: p.intelligenceSuiteEnabled ? "Enabled" : "Disabled", to: suite ? "Enabled" : "Disabled" })
  } else if (sortedOldMods !== sortedNewMods) {
    const added   = modules.filter(m => !p.intelligenceModules.includes(m))
    const removed = p.intelligenceModules.filter(m => !modules.includes(m))
    if (added.length)   changes.push({ label: "Modules added",   from: "", to: added.map(m => INTELLIGENCE_MODULES.find(x => x.id === m)?.label ?? m).join(", ") })
    if (removed.length) changes.push({ label: "Modules removed", from: removed.map(m => INTELLIGENCE_MODULES.find(x => x.id === m)?.label ?? m).join(", "), to: "" })
  }

  const newDiscPct = discountPct ? Number(discountPct) : null
  const oldDiscPct = p.discountPercent
  if (newDiscPct !== oldDiscPct) {
    changes.push({
      label: "Founding discount",
      from: oldDiscPct ? `${oldDiscPct}%` : "None",
      to:   newDiscPct ? `${newDiscPct}% (${discountLabel || "Founding Customer"})` : "None",
    })
  }

  if (freq !== p.billingFrequency) {
    changes.push({ label: "Billing", from: p.billingFrequency, to: freq })
  }

  const priceNum = price ? Number(price) : null
  if (priceNum !== (p.currentPrice ?? null)) {
    changes.push({
      label: "Custom price override",
      from: p.currentPrice != null ? `$${p.currentPrice}` : "Standard",
      to:   priceNum != null ? `$${priceNum}` : "Standard",
    })
  }

  // Estimate new monthly if the plan is a known Stripe plan
  let newMonthly: number | null = null
  if (PLAN_KEYS.has(plan) && empNum != null && locNum != null) {
    try {
      const result = calculatePrice({
        plan: plan as PlanKey,
        employeeCount: empNum,
        locationCount: locNum,
        selectedModuleIds: modules as ModuleId[],
        intelligenceSuite: suite,
        discountPercent: newDiscPct ?? 0,
      })
      newMonthly = result.totalAfterDiscount
    } catch {}
  }

  return { changes, newMonthly }
}

export function OrgPricing({ pricing }: { pricing: PricingData }) {
  const router = useRouter()
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")
  const [success,  setSuccess]  = useState("")

  // Edit state
  const [plan,    setPlan]    = useState(pricing.plan)
  const [status,  setStatus]  = useState(pricing.subscriptionStatus)
  const [freq,    setFreq]    = useState(pricing.billingFrequency)
  const [price,   setPrice]   = useState(pricing.currentPrice != null ? String(pricing.currentPrice) : "")
  const [locked,  setLocked]  = useState(pricing.priceLockedUntil ? pricing.priceLockedUntil.slice(0, 10) : "")
  const [modules, setModules] = useState<string[]>(pricing.intelligenceModules)
  const [suite,   setSuite]   = useState(pricing.intelligenceSuiteEnabled)
  const [empCount, setEmpCount] = useState(pricing.employeeCount != null ? String(pricing.employeeCount) : "")
  const [locCount, setLocCount] = useState(pricing.locationCount != null ? String(pricing.locationCount) : "")

  // Discount
  const [discountPct,     setDiscountPct]     = useState(pricing.discountPercent != null ? String(pricing.discountPercent) : "")
  const [discountExpires, setDiscountExpires] = useState(pricing.discountExpiresAt ? pricing.discountExpiresAt.slice(0, 10) : "")
  const [discountLabel,   setDiscountLabel]   = useState(pricing.discountLabel ?? "")

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState<{ changes: ChangeItem[]; newMonthly: number | null } | null>(null)
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)

  function toggleModule(id: string) {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  function cancelEdit() {
    setPlan(pricing.plan)
    setStatus(pricing.subscriptionStatus)
    setFreq(pricing.billingFrequency)
    setPrice(pricing.currentPrice != null ? String(pricing.currentPrice) : "")
    setLocked(pricing.priceLockedUntil ? pricing.priceLockedUntil.slice(0, 10) : "")
    setModules(pricing.intelligenceModules)
    setSuite(pricing.intelligenceSuiteEnabled)
    setEmpCount(pricing.employeeCount != null ? String(pricing.employeeCount) : "")
    setLocCount(pricing.locationCount != null ? String(pricing.locationCount) : "")
    setDiscountPct(pricing.discountPercent != null ? String(pricing.discountPercent) : "")
    setDiscountExpires(pricing.discountExpiresAt ? pricing.discountExpiresAt.slice(0, 10) : "")
    setDiscountLabel(pricing.discountLabel ?? "")
    setEditing(false)
    setError("")
    setConfirmOpen(false)
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {}

    if (plan !== pricing.plan) payload.plan = plan
    if (freq !== pricing.billingFrequency) payload.billingFrequency = freq

    const priceVal = price === "" ? null : Number(price)
    if (priceVal !== (pricing.currentPrice ?? null)) payload.currentPrice = priceVal

    const lockedVal = locked || null
    const origLocked = pricing.priceLockedUntil ? pricing.priceLockedUntil.slice(0, 10) : null
    if (lockedVal !== origLocked) payload.priceLockedUntil = lockedVal ? new Date(lockedVal).toISOString() : null

    const sortedNew = [...modules].sort().join(",")
    const sortedOld = [...pricing.intelligenceModules].sort().join(",")
    if (sortedNew !== sortedOld) payload.intelligenceModules = modules
    if (suite !== pricing.intelligenceSuiteEnabled) payload.intelligenceSuiteEnabled = suite

    const empNum = empCount ? Number(empCount) : null
    if (empNum !== (pricing.employeeCount ?? null)) payload.employeeCount = empNum

    const locNum = locCount ? Number(locCount) : null
    if (locNum !== (pricing.locationCount ?? null)) payload.locationCount = locNum

    const discPct = discountPct === "" ? null : Number(discountPct)
    if (discPct !== (pricing.discountPercent ?? null)) payload.discountPercent = discPct

    const discExp = discountExpires || null
    const origExp = pricing.discountExpiresAt ? pricing.discountExpiresAt.slice(0, 10) : null
    if (discExp !== origExp) payload.discountExpiresAt = discExp ? new Date(discExp).toISOString() : null

    const label = discountLabel.trim() || null
    if (label !== (pricing.discountLabel ?? null)) payload.discountLabel = label

    return payload
  }

  function handleSaveClick() {
    setError("")
    const payload = buildPayload()
    if (Object.keys(payload).length === 0) { setEditing(false); return }

    const desc = describeChanges(pricing, { plan, empCount, locCount, modules, suite, discountPct, discountExpires, discountLabel, freq, price, locked })
    setConfirmData(desc)
    setPendingPayload(payload)
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (!pendingPayload) return
    setSaving(true)
    setError("")
    setConfirmOpen(false)

    try {
      const res = await fetch(`/api/super-admin/organizations/${pricing.orgId}/subscription`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pendingPayload),
      })
      const json = await res.json() as { error?: string; stripeActions?: string[] }
      if (!res.ok) { setError(json.error ?? "Failed to save"); return }

      setSuccess("Saved")
      setTimeout(() => setSuccess(""), 3000)
      setEditing(false)
      router.refresh()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  // Status-only save (doesn't touch Stripe)
  async function saveStatusOnly() {
    if (status === pricing.subscriptionStatus) { setEditing(false); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/super-admin/organizations/${pricing.orgId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptionStatus: status, _pricingUpdate: true }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setError(json.error ?? "Failed"); return }
      setSuccess("Saved"); setTimeout(() => setSuccess(""), 3000)
      setEditing(false); router.refresh()
    } catch { setError("Network error") }
    finally { setSaving(false) }
  }

  const planLabel   = PLAN_OPTIONS.find(p => p.value === pricing.plan)?.label ?? pricing.plan
  const activeModuleLabels = INTELLIGENCE_MODULES
    .filter(m => pricing.intelligenceModules.includes(m.id))
    .map(m => m.label)
  const isReadOnly  = pricing.subscriptionStatus === "read_only" || pricing.subscriptionStatus === "expired"
  const hasDiscount = pricing.discountPercent != null && pricing.discountPercent > 0
  const isEnterprise = pricing.plan === "enterprise"
  const hasStripe = !!pricing.stripeSubscriptionId
  const isLegacyPlan = !PLAN_KEYS.has(pricing.plan) && pricing.plan !== "enterprise"

  const editPlanIsStripe = PLAN_KEYS.has(plan)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      {/* Confirmation dialog */}
      {confirmOpen && confirmData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-white font-semibold text-sm mb-1">Confirm billing changes</h3>
            <p className="text-gray-400 text-xs mb-4">
              {hasStripe ? "These changes will be applied to the Stripe subscription immediately." : "No Stripe subscription — only the database will be updated."}
            </p>

            {confirmData.changes.length === 0 ? (
              <p className="text-gray-500 text-xs mb-4">No billing changes detected.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {confirmData.changes.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-500 w-32 shrink-0">{c.label}</span>
                    <span className="text-gray-300">
                      {c.from && <span className="line-through text-gray-600 mr-1">{c.from}</span>}
                      {c.to && <span className="text-green-400">{c.to}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {confirmData.newMonthly != null && (
              <div className="mb-4 px-3 py-2 bg-indigo-900/30 border border-indigo-800 rounded-lg">
                <p className="text-indigo-300 text-xs font-semibold">
                  Estimated new monthly total: ${confirmData.newMonthly.toLocaleString()}/mo
                </p>
                {pricing.monthlyTotalAfterDiscount != null && (
                  <p className="text-gray-500 text-[11px]">
                    Previously: ${pricing.monthlyTotalAfterDiscount.toLocaleString()}/mo
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirm changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Subscription & Pricing</h2>
          {isReadOnly && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-800">
              READ-ONLY
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {success && <span className="text-green-400 text-xs">{success}</span>}
          {error   && <span className="text-red-400 text-xs">{error}</span>}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={cancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-xs rounded-lg transition-colors">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button onClick={handleSaveClick} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {!editing ? (
        /* ── Read-only view ── */
        <div className="space-y-4">
          {/* Enterprise note */}
          {isEnterprise && (
            <div className="flex items-start gap-2 p-3 bg-indigo-950/50 border border-indigo-900 rounded-lg">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-indigo-300 text-xs font-semibold">Enterprise plan — manual provisioning</p>
                <p className="text-indigo-500 text-[11px]">Billing is managed directly in Stripe. No automated subscription changes.</p>
              </div>
              {pricing.stripeCustomerId && (
                <a
                  href={`https://dashboard.stripe.com/customers/${pricing.stripeCustomerId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[11px] shrink-0"
                >
                  Stripe <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* No Stripe subscription warning */}
          {!isEnterprise && !hasStripe && !isLegacyPlan && (
            <div className="flex items-start gap-2 p-3 bg-amber-950/50 border border-amber-900 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs">
                No Stripe subscription linked. Changes here will only update the database — no billing will occur.
              </p>
            </div>
          )}

          {isLegacyPlan && (
            <div className="flex items-start gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg">
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-gray-400 text-xs">
                Legacy plan (<strong>{pricing.plan}</strong>). Upgrade to a current plan to enable Stripe billing management.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-1">Plan</p>
              <p className="text-white text-sm font-semibold">{planLabel}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-1">Status</p>
              <p className="text-white text-sm capitalize">{pricing.subscriptionStatus}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-1">Billing</p>
              <p className="text-white text-sm capitalize">{pricing.billingFrequency}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-1">Custom Price</p>
              <p className="text-white text-sm">
                {pricing.currentPrice != null
                  ? `$${pricing.currentPrice.toLocaleString()} / ${pricing.billingFrequency === "annual" ? "yr" : "mo"}`
                  : <span className="text-gray-500">Standard</span>}
              </p>
            </div>
          </div>

          {/* Employees / Locations */}
          {(pricing.employeeCount != null || pricing.locationCount != null || pricing.companySize || pricing.numberOfLocations) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-1">Employees</p>
                <p className="text-white text-sm">
                  {pricing.employeeCount != null
                    ? `${pricing.employeeCount} (${bandLabel(pricing.plan, pricing.employeeCount)} band)`
                    : pricing.companySize ?? <span className="text-gray-500">—</span>}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-1">Locations</p>
                <p className="text-white text-sm">
                  {pricing.locationCount != null
                    ? String(pricing.locationCount)
                    : pricing.numberOfLocations ?? <span className="text-gray-500">—</span>}
                </p>
              </div>
            </div>
          )}

          {/* Calculated pricing breakdown */}
          {pricing.monthlyTotalBeforeDiscount != null && (
            <div className="pt-3 border-t border-gray-800 space-y-1.5">
              <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-2">Monthly Breakdown</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {pricing.monthlyBasePrice     != null && <div><span className="text-gray-500 text-xs">Base </span><span className="text-white">${pricing.monthlyBasePrice}/mo</span></div>}
                {pricing.monthlyScalingCost   != null && pricing.monthlyScalingCost > 0 && <div><span className="text-gray-500 text-xs">Scaling </span><span className="text-white">${pricing.monthlyScalingCost}/mo</span></div>}
                {pricing.monthlyModulesCost   != null && pricing.monthlyModulesCost > 0 && <div><span className="text-gray-500 text-xs">Modules </span><span className="text-white">${pricing.monthlyModulesCost}/mo</span></div>}
                {pricing.monthlyTotalAfterDiscount != null && (
                  <div>
                    <span className="text-gray-500 text-xs">Total </span>
                    <span className="text-white font-semibold">${pricing.monthlyTotalAfterDiscount}/mo</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discount */}
          {hasDiscount && (
            <div className="pt-3 border-t border-gray-800">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-green-900/30 border border-green-800 rounded-lg">
                <Tag className="w-3.5 h-3.5 text-green-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-green-300 text-xs font-semibold">
                    {pricing.discountLabel ?? "Discount"} — {pricing.discountPercent}% off
                  </p>
                  {pricing.discountExpiresAt && (
                    <p className="text-green-500 text-[11px]">
                      Locked until {new Date(pricing.discountExpiresAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
                {pricing.monthlyTotalBeforeDiscount != null && pricing.discountPercent && (
                  <p className="text-green-400 text-xs font-semibold shrink-0">
                    −${Math.round(pricing.monthlyTotalBeforeDiscount * (pricing.discountPercent / 100))}/mo
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Checkout intent */}
          {pricing.checkoutIntentStatus && (
            <div className="pt-3 border-t border-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-amber-300 text-xs">
                Checkout intent: <strong>{pricing.checkoutIntentStatus}</strong> — customer has selected a plan but not paid yet
              </p>
            </div>
          )}

          {/* Read-only quick action */}
          <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isReadOnly
                ? <ToggleLeft className="w-4 h-4 text-red-400" />
                : <ToggleRight className="w-4 h-4 text-green-400" />
              }
              <p className="text-gray-400 text-xs">
                {isReadOnly ? "Currently in read-only / expired mode" : "Full access enabled"}
              </p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {isReadOnly ? "Restore access" : "Set read-only"}
            </button>
          </div>

          {/* Modules */}
          <div className="pt-3 border-t border-gray-800">
            <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide mb-1.5">
              Intelligence Modules {pricing.intelligenceSuiteEnabled && "(Suite)"}
            </p>
            {activeModuleLabels.length === 0
              ? <span className="text-gray-600 text-sm">None enabled</span>
              : <div className="flex flex-wrap gap-1.5">
                  {activeModuleLabels.map(l => (
                    <span key={l} className="text-xs px-2 py-0.5 bg-indigo-900/50 text-indigo-300 border border-indigo-800 rounded-full">{l}</span>
                  ))}
                </div>
            }
          </div>

          {/* Stripe links */}
          {pricing.stripeCustomerId && (
            <div className="pt-3 border-t border-gray-800 flex items-center gap-3 text-[11px] text-gray-500">
              <a href={`https://dashboard.stripe.com/customers/${pricing.stripeCustomerId}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-indigo-400">
                Customer <ExternalLink className="w-3 h-3" />
              </a>
              {pricing.stripeSubscriptionId && (
                <a href={`https://dashboard.stripe.com/subscriptions/${pricing.stripeSubscriptionId}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-indigo-400">
                  Subscription <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Edit form ── */
        <div className="space-y-5">
          {/* Stripe warning in edit mode */}
          {!hasStripe && plan !== "enterprise" && !["custom", "free", "starter"].includes(plan) && (
            <div className="flex items-start gap-2 p-3 bg-amber-950/50 border border-amber-900 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs">
                No Stripe subscription linked. Saving will update the database only — no billing will occur.
              </p>
            </div>
          )}

          {/* Core subscription */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Subscription</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Plan tier</label>
                <select value={plan} onChange={e => setPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  {isLegacyPlan && (
                    <option value={pricing.plan}>{pricing.plan} (legacy)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Subscription status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Billing frequency</label>
                <div className="flex rounded-lg border border-gray-700 overflow-hidden">
                  {["monthly", "annual"].map(f => (
                    <button key={f} type="button" onClick={() => setFreq(f)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${freq === f ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Custom price (USD / {freq === "annual" ? "yr" : "mo"})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min={0} step="0.01" value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="Standard"
                    className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <p className="text-gray-600 text-[11px] mt-1">Leave blank for standard pricing</p>
              </div>
            </div>

            {(status === "read_only" || status === "expired") && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-red-950/50 border border-red-900 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs">
                  Setting status to <strong>{status}</strong> will put this org in read-only mode.
                </p>
              </div>
            )}
          </div>

          {/* Enterprise note */}
          {plan === "enterprise" ? (
            <div className="pt-4 border-t border-gray-800">
              <div className="flex items-start gap-2 p-3 bg-indigo-950/50 border border-indigo-900 rounded-lg">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-indigo-300 text-xs font-semibold">Enterprise plan — no automated Stripe changes</p>
                  <p className="text-indigo-500 text-[11px] mt-0.5">Manage billing manually in the Stripe dashboard.</p>
                  {pricing.stripeCustomerId && (
                    <a
                      href={`https://dashboard.stripe.com/customers/${pricing.stripeCustomerId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-[11px] mt-1.5"
                    >
                      Open in Stripe <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Employee & location scaling */}
              {editPlanIsStripe && (
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Scaling</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Employee count</label>
                      <input
                        type="number" min={1} value={empCount}
                        onChange={e => setEmpCount(e.target.value)}
                        placeholder={pricing.companySize ?? "e.g. 50"}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {empCount && PLAN_KEYS.has(plan) && (
                        <p className="text-indigo-400 text-[11px] mt-1">
                          Band: {bandLabel(plan, Number(empCount))}
                          {plan === "professional" && ` (+$${PRO_EMPLOYEE_BANDS.find(b => Number(empCount) >= b.min && (b.max === null || Number(empCount) <= b.max))?.additionalCost ?? 0}/mo)`}
                          {plan === "professional_plus" && ` (+$${PP_EMPLOYEE_BANDS.find(b => Number(empCount) >= b.min && (b.max === null || Number(empCount) <= b.max))?.additionalCost ?? 0}/mo)`}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Number of locations</label>
                      <input
                        type="number" min={1} value={locCount}
                        onChange={e => setLocCount(e.target.value)}
                        placeholder={pricing.numberOfLocations ?? "e.g. 1"}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {locCount && PLAN_KEYS.has(plan) && (() => {
                        const planCfg = PLANS[plan as PlanKey]
                        const extra = Math.max(0, Number(locCount) - planCfg.includedLocations)
                        return extra > 0 ? (
                          <p className="text-indigo-400 text-[11px] mt-1">
                            {extra} extra location{extra !== 1 ? "s" : ""} × ${planCfg.additionalLocationPrice}/mo = +${extra * planCfg.additionalLocationPrice}/mo
                          </p>
                        ) : (
                          <p className="text-gray-500 text-[11px] mt-1">
                            {planCfg.includedLocations} location{planCfg.includedLocations !== 1 ? "s" : ""} included in base price
                          </p>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Founding customer discount */}
              <div className="pt-4 border-t border-gray-800">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-green-400" />
                  Founding Customer Discount
                </p>
                {hasStripe && (
                  <p className="text-gray-600 text-[11px] mb-3">Applied as a Stripe coupon. A new coupon will be created when saved; the old one will be deleted.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Discount %</label>
                    <div className="relative">
                      <input type="number" min={0} max={100} value={discountPct}
                        onChange={e => setDiscountPct(e.target.value)}
                        placeholder="e.g. 30"
                        className="w-full pr-8 pl-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Discount label</label>
                    <input type="text" value={discountLabel}
                      onChange={e => setDiscountLabel(e.target.value)}
                      placeholder="e.g. Founding Customer"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Discount locked until</label>
                    <input type="date" value={discountExpires}
                      onChange={e => setDiscountExpires(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <p className="text-gray-600 text-[11px] mt-1">Leave blank for no expiry</p>
                  </div>
                </div>
              </div>

              {/* Price lock and modules */}
              <div className="pt-4 border-t border-gray-800">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Price Lock & Modules</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Price locked until</label>
                    <input type="date" value={locked} onChange={e => setLocked(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <p className="text-gray-600 text-[11px] mt-1">Promotional / legacy price lock-in date</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Intelligence Suite (all modules)</label>
                    <button type="button" onClick={() => setSuite(s => !s)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        suite ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                      }`}>
                      {suite ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {suite ? "Suite enabled" : "Suite disabled"}
                    </button>
                    {plan === "professional_plus" && (
                      <p className="text-gray-600 text-[11px] mt-1.5">Included in Professional Plus base price</p>
                    )}
                  </div>
                </div>

                {plan !== "essentials" && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Individual modules</label>
                    <div className="flex flex-wrap gap-2">
                      {INTELLIGENCE_MODULES.map(m => {
                        const active = suite || modules.includes(m.id)
                        const includedInPP = plan === "professional_plus"
                        return (
                          <button key={m.id} type="button"
                            onClick={() => !suite && !includedInPP && toggleModule(m.id)}
                            disabled={suite || includedInPP}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              suite || includedInPP
                                ? "bg-indigo-900/40 text-indigo-400 border-indigo-800 cursor-default"
                                : active
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "bg-gray-800 text-gray-400 border-gray-700 hover:border-indigo-700 hover:text-indigo-300"
                            }`}>
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
