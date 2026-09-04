"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Check, ChevronRight, Loader2, Star, AlertTriangle,
  Users, MapPin, Zap, Package, Lock,
} from "lucide-react"
import {
  PLANS, PRO_EMPLOYEE_BANDS, PP_EMPLOYEE_BANDS, INTELLIGENCE_MODULES, INTELLIGENCE_SUITE_PRICE,
  calculatePrice, getEmployeeBand, type PlanKey, type ModuleId,
} from "@/lib/pricing"

const UPGRADE_PLANS: PlanKey[] = ["essentials", "professional", "professional_plus"]

const PLAN_FEATURES: Record<string, string[]> = {
  essentials: [
    "Issue Reporting & Tracking",
    "Automatic Routing & Assignments",
    "Suggestion Box",
    "Team Roles & Permissions",
    "Mobile App (PWA)",
    "Max 1 location · Max 25 employees",
  ],
  professional: [
    "Everything in Essentials",
    "Asset & Equipment Management",
    "Vendor Management",
    "Injury & Safety Reporting",
    "Multi-location support (up to 15)",
    "Advanced Analytics",
    "Purchase Approval Workflows",
    "Intelligence Modules (AI add-ons)",
  ],
  professional_plus: [
    "Everything in Professional",
    "Intelligence Suite included ($199 value)",
    "Executive AI Briefings",
    "Corporate Hierarchy (Org → Region → Location)",
    "Executive Dashboards & KPIs",
    "Unlimited locations (up to 100)",
    "API & Webhooks",
    "Priority Support",
  ],
}

export function UpgradeSelector({
  initialEmployeeCount,
  initialLocationCount,
  discountPercent,
  discountExpiresAt,
  discountLabel,
}: {
  initialEmployeeCount: number
  initialLocationCount: number
  discountPercent:      number | null
  discountExpiresAt:    string | null
  discountLabel:        string | null
}) {
  const router = useRouter()
  const [tier,            setTier]          = useState<PlanKey>("professional")
  const [employeeCount,   setEmployeeCount] = useState(Math.max(1, initialEmployeeCount))
  const [locationCount,   setLocationCount] = useState(Math.max(1, initialLocationCount))
  const [selectedModules, setSelectedModules] = useState<Set<ModuleId>>(new Set())
  const [suitePurchased,  setSuitePurchased] = useState(false)
  const [saving,          setSaving]        = useState(false)
  const [error,           setError]         = useState("")

  const isPro  = tier === "professional"
  const isPP   = tier === "professional_plus"
  const isEss  = tier === "essentials"

  const band        = getEmployeeBand(employeeCount, tier)
  const currentBands = isPP ? PP_EMPLOYEE_BANDS : PRO_EMPLOYEE_BANDS

  const pricing = calculatePrice({
    plan:              tier,
    employeeCount,
    locationCount,
    selectedModuleIds: Array.from(selectedModules),
    intelligenceSuite: suitePurchased || isPP,
    discountPercent:   discountPercent ?? undefined,
  })

  useEffect(() => {
    if (isEss) { setEmployeeCount(c => Math.min(c, 25)); setLocationCount(1) }
    if (isPro) { setEmployeeCount(c => Math.min(c, 500)); setLocationCount(c => Math.min(c, 15)) }
    if (isPP)  { setEmployeeCount(c => Math.min(c, 2500)); setLocationCount(c => Math.min(c, 100)) }
  }, [tier]) // eslint-disable-line react-hooks/exhaustive-deps

  const locationIncluded = PLANS[tier].includedLocations
  const locationMax      = PLANS[tier].maxLocations

  function toggleModule(id: ModuleId) {
    setSelectedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleUpgrade() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/subscription/upgrade-to-relay", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan:              tier,
          employeeCount,
          locationCount,
          selectedModuleIds: Array.from(selectedModules),
          intelligenceSuite: suitePurchased || isPP,
        }),
      })
      const j = await res.json().catch(() => ({})) as { success?: boolean; error?: string }
      if (!res.ok) { setError(j.error ?? "Upgrade failed. Please try again."); return }
      router.push("/settings/subscription?upgraded=1")
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {UPGRADE_PLANS.map(p => {
          const plan        = PLANS[p]
          const isSelected  = tier === p
          const isRecommended = p === "professional"
          const isPPCard    = p === "professional_plus"
          return (
            <button
              key={p}
              type="button"
              onClick={() => setTier(p)}
              className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
                isSelected
                  ? isPPCard
                    ? "border-purple-600 bg-purple-50 shadow-md"
                    : "border-blue-600 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-blue-300"
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full whitespace-nowrap">
                  <Star className="w-3 h-3" />
                  Recommended
                </div>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{plan.label}</h3>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    ${plan.basePrice}<span className="text-xs font-normal text-gray-500">/mo</span>
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 shrink-0 ${
                  isSelected
                    ? isPPCard ? "border-purple-600 bg-purple-600" : "border-blue-600 bg-blue-600"
                    : "border-gray-300"
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
              <ul className="space-y-1.5 mt-3">
                {(PLAN_FEATURES[p] ?? []).map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                    <Check className={`w-3 h-3 shrink-0 mt-0.5 ${isPPCard ? "text-purple-500" : "text-green-500"}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {/* Employee config */}
      {(isPro || isPP) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Employee count</h2>
            {isPP && <span className="text-xs text-gray-500">250 included</span>}
            {isPro && <span className="text-xs text-gray-500">50 included, max 500</span>}
          </div>
          <div className="flex items-center gap-4 mb-3">
            <input
              type="number"
              min={1}
              max={isPP ? 2500 : 500}
              value={employeeCount}
              onChange={e => setEmployeeCount(Math.min(isPP ? 2500 : 500, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500 text-sm">employees</span>
          </div>
          <div className={`grid gap-2 ${isPP ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-5"}`}>
            {currentBands.map(b => (
              <button
                key={b.label}
                type="button"
                onClick={() => setEmployeeCount(b.min)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  employeeCount >= b.min && (b.max === null || employeeCount <= b.max)
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          {band.additionalCost > 0 && (
            <p className="text-xs text-gray-500 mt-3">+${band.additionalCost}/mo for {band.label} employees</p>
          )}
        </div>
      )}

      {isEss && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-700">Employee count</h2>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={25}
              value={employeeCount}
              onChange={e => setEmployeeCount(Math.min(25, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500 text-sm">employees (max 25)</span>
          </div>
        </div>
      )}

      {/* Location config */}
      {(isPro || isPP) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Locations</h2>
            <span className="text-xs text-gray-500">
              {locationIncluded} included · {isPP ? "+$40/mo" : "+$50/mo"} per additional · max {locationMax}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLocationCount(n => Math.max(locationIncluded, n - 1))}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              −
            </button>
            <span className="text-lg font-semibold text-gray-900 w-8 text-center">{locationCount}</span>
            <button
              type="button"
              onClick={() => setLocationCount(n => Math.min(locationMax, n + 1))}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              +
            </button>
            <span className="text-sm text-gray-500">
              location{locationCount !== 1 ? "s" : ""}
              {locationCount > locationIncluded && (
                <span className="text-gray-400"> · {locationCount - locationIncluded} additional</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Intelligence Modules — Professional only */}
      {isPro && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Intelligence Modules</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">AI-powered intelligence add-ons.</p>
          <button
            type="button"
            onClick={() => { setSuitePurchased(!suitePurchased); if (!suitePurchased) setSelectedModules(new Set()) }}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 mb-3 transition-all ${
              suitePurchased ? "border-indigo-600 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                suitePurchased ? "border-indigo-600 bg-indigo-600" : "border-gray-300"
              }`}>
                {suitePurchased && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Relay Intelligence Suite</p>
                <p className="text-xs text-gray-500">All 5 modules — best value</p>
              </div>
            </div>
            <p className="text-lg font-bold text-gray-900">${INTELLIGENCE_SUITE_PRICE}<span className="text-xs font-normal text-gray-500">/mo</span></p>
          </button>
          <div className="space-y-2">
            {INTELLIGENCE_MODULES.map(mod => {
              const active  = suitePurchased || selectedModules.has(mod.id)
              const inSuite = suitePurchased
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => !inSuite && toggleModule(mod.id)}
                  disabled={inSuite}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${
                    inSuite   ? "border-indigo-200 bg-indigo-50/50 opacity-75 cursor-default"
                    : active  ? "border-blue-500 bg-blue-50"
                             : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      active ? inSuite ? "border-indigo-400 bg-indigo-400" : "border-blue-600 bg-blue-600"
                             : "border-gray-300"
                    }`}>
                      {active && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="font-medium text-gray-800">{mod.label}</span>
                  </div>
                  <span className="text-gray-600">${mod.price}/mo</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* PP: Intelligence Suite included */}
      {isPP && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-purple-900 text-sm">Intelligence Suite — Included</span>
            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">$199 value</span>
          </div>
          <p className="text-xs text-purple-700 mt-1">All 5 Intelligence Modules included in Professional Plus.</p>
        </div>
      )}

      {/* Essentials: Modules locked */}
      {isEss && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-500 text-sm">Intelligence Modules</span>
            <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Professional required</span>
          </div>
        </div>
      )}

      {/* Price summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Monthly total after upgrade</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{PLANS[tier].label} base</span>
            <span>${pricing.basePrice}/mo</span>
          </div>
          {pricing.employeeScaling > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Employee scaling ({band.label})</span>
              <span>+${pricing.employeeScaling}/mo</span>
            </div>
          )}
          {pricing.locationScaling > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">
                Location scaling ({Math.max(0, locationCount - locationIncluded)} additional)
              </span>
              <span>+${pricing.locationScaling}/mo</span>
            </div>
          )}
          {pricing.moduleCost > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">{suitePurchased ? "Intelligence Suite" : "Intelligence Modules"}</span>
              <span>+${pricing.moduleCost}/mo</span>
            </div>
          )}
          {pricing.discountAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>{discountLabel ?? "Discount"} ({discountPercent}% off
                {discountExpiresAt && `, until ${new Date(discountExpiresAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`})
              </span>
              <span>−${pricing.discountAmount}/mo</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
            <span>Monthly total</span>
            <span className="text-2xl">${pricing.totalAfterDiscount}/mo</span>
          </div>
        </div>
      </div>

      {/* At-limit warning for Pro */}
      {isPro && employeeCount >= 500 && (
        <div className="flex items-start gap-2 p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-purple-500" />
          <p>Professional supports up to 500 employees. Consider Professional Plus for larger teams.</p>
        </div>
      )}

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="button"
        onClick={handleUpgrade}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-semibold rounded-2xl text-base transition-colors ${
          isPP
            ? "bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white"
            : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
        }`}
      >
        {saving
          ? <><Loader2 className="w-5 h-5 animate-spin" /> Upgrading…</>
          : <>Confirm Upgrade to {PLANS[tier].label} <ChevronRight className="w-5 h-5" /></>
        }
      </button>
      <p className="text-xs text-gray-400 text-center">
        Prorated charges apply if upgrading from an active subscription. Secured by Stripe.
      </p>
    </div>
  )
}
