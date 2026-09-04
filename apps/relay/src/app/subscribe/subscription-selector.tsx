"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Check, ChevronRight, AlertTriangle, Zap, Building2,
  Users, MapPin, Loader2, Star, Lock, Phone, Droplets,
} from "lucide-react"
import { RelayWordmark } from "@/components/logo"
import {
  PLANS, PRO_EMPLOYEE_BANDS, PP_EMPLOYEE_BANDS,
  INTELLIGENCE_MODULES, INTELLIGENCE_SUITE_PRICE,
  calculatePrice, getEmployeeBand,
  type PlanKey, type ModuleId,
} from "@/lib/pricing"

// ─── Plan feature lists ───────────────────────────────────────────────────────

const ESSENTIALS_FEATURES = [
  "Issue Reporting & Tracking",
  "Automatic Routing & Assignments",
  "Suggestion Box",
  "Resolution Tracking",
  "Team Roles & Permissions",
  "Departments",
  "Calendar",
  "Mobile App (PWA)",
  "Public QR Reporting",
]

const PROFESSIONAL_FEATURES = [
  "Everything in Essentials",
  "Asset & Equipment Management",
  "Vendor Management",
  "Injury & Safety Reporting",
  "Advanced Analytics",
  "Multi-location support",
  "Smart QR Assets & Locations",
  "External Collaborators (unlimited, no seat cost)",
  "Purchase Approval workflows",
  "Intelligence Modules (AI add-ons, +$49/mo each)",
]

const PP_FEATURES = [
  "Everything in Professional",
  "Intelligence Suite included ($199 value)",
  "Executive AI Briefings (daily, weekly, monthly)",
  "AI Operational Health Scores",
  "AI Trend Detection",
  "Corporate Hierarchy (Org → Region → Location)",
  "Executive Dashboards & KPIs",
  "Executive Goals Tracking",
  "Shared Facilities & Org Linking",
  "Multi-Organization Switching",
  "API & Webhooks",
  "Priority Support",
]

const ENTERPRISE_FEATURES = [
  "Everything in Professional Plus",
  "Custom employee & location limits",
  "Custom pricing & contract terms",
  "Dedicated onboarding & success manager",
  "SLA guarantees",
  "Custom integrations",
  "Volume discounts",
]

const WASH_ESSENTIALS_FEATURES = [
  "Issue Reporting & Tracking",
  "Automatic Routing & Assignments",
  "1–7 Locations ($10/mo each after 1st)",
  "Team Roles & Permissions",
  "Mobile App (PWA)",
  "Public QR Reporting",
]

// ─── Sub-components ───────────────────────────────────────────────────────────

type Tier = PlanKey | "enterprise"

function PlanCard({
  tier,
  selected,
  recommended,
  onClick,
}: {
  tier:        Tier
  selected:    boolean
  recommended: boolean
  onClick:     () => void
}) {
  const isEnterprise = tier === "enterprise"
  const isPP         = tier === "professional_plus"
  const plan         = !isEnterprise ? PLANS[tier] : null

  const features = {
    essentials:        ESSENTIALS_FEATURES,
    professional:      PROFESSIONAL_FEATURES,
    professional_plus: PP_FEATURES,
    enterprise:        ENTERPRISE_FEATURES,
    wash_essentials:   WASH_ESSENTIALS_FEATURES,
  }[tier]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left p-6 rounded-2xl border-2 transition-all w-full ${
        selected
          ? isPP
            ? "border-purple-600 bg-purple-50 shadow-md"
            : isEnterprise
            ? "border-gray-700 bg-gray-50 shadow-md"
            : "border-blue-600 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300"
      }`}
    >
      {recommended && !isEnterprise && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full whitespace-nowrap">
          <Star className="w-3 h-3" />
          Recommended
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900 text-base">
            {isEnterprise ? "Relay Enterprise" : plan!.label}
          </h3>
          {isEnterprise ? (
            <p className="text-lg font-bold text-gray-900 mt-1">Custom pricing</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${plan!.basePrice}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isPP ? "250 employees + 10 locations + Intel Suite included" : "base price"}
              </p>
            </>
          )}
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors mt-1 shrink-0 ${
          selected
            ? isPP
              ? "border-purple-600 bg-purple-600"
              : isEnterprise
              ? "border-gray-700 bg-gray-700"
              : "border-blue-600 bg-blue-600"
            : "border-gray-300"
        }`}>
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>

      <ul className="space-y-1.5 mt-4">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isPP ? "text-purple-500" : "text-green-500"}`} />
            {f}
          </li>
        ))}
      </ul>

      {tier === "essentials" && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
          {[
            "Max 1 location",
            "Max 25 employees",
            "No Intelligence Modules",
          ].map((l) => (
            <p key={l} className="flex items-center gap-1.5 text-xs text-gray-400">
              <Lock className="w-3 h-3 shrink-0" />
              {l}
            </p>
          ))}
        </div>
      )}
    </button>
  )
}

function PriceRow({ label, amount, positive }: { label: string; amount: number; positive?: boolean }) {
  if (amount === 0) return null
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-gray-600">{label}</span>
      <span className={positive ? "text-green-600 font-medium" : "text-gray-900"}>
        {positive ? "−" : "+"}${amount}/mo
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SubscriptionSelector({
  orgName,
  isCarWash,
  initialPlan,
  initialEmployeeCount,
  initialLocationCount,
  initialModules,
  initialSuite,
  discountPercent,
  discountExpiresAt,
  discountLabel,
  highlightSection,
}: {
  orgName:              string
  isCarWash:            boolean
  initialPlan:          PlanKey
  initialEmployeeCount: number
  initialLocationCount: number
  initialModules:       string[]
  initialSuite:         boolean
  discountPercent:      number | null
  discountExpiresAt:    string | null
  discountLabel:        string | null
  highlightSection:     string | null
}) {
  const [tier,            setTier]            = useState<Tier>(initialPlan)
  const [employeeCount,   setEmployeeCount]   = useState(initialEmployeeCount)
  const [locationCount,   setLocationCount]   = useState(initialLocationCount)
  const [selectedModules, setSelectedModules] = useState<Set<ModuleId>>(
    new Set(initialModules.filter((m): m is ModuleId =>
      INTELLIGENCE_MODULES.some(im => im.id === m)
    ))
  )
  const [suitePurchased, setSuitePurchased] = useState(initialSuite)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  // ── Wash Essentials independent state ────────────────────────────────────────
  const washInitialCount = Math.min(7, Math.max(1, initialLocationCount))
  const [washLocationCount, setWashLocationCount] = useState(washInitialCount)
  const [washSaving, setWashSaving] = useState(false)
  const [washError,  setWashError]  = useState("")

  const washAdditional     = Math.max(0, washLocationCount - 1)
  const washBase           = 40
  const washTotal          = washBase + washAdditional * 10
  const washDiscountAmount = discountPercent ? Math.round(washTotal * (discountPercent / 100)) : 0
  const washFinal          = washTotal - washDiscountAmount

  async function handleWashCheckout() {
    setWashSaving(true)
    setWashError("")
    try {
      const res = await fetch("/api/subscription/checkout-intent", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "wash_essentials", locationCount: washLocationCount }),
      })
      const j = await res.json().catch(() => ({})) as { checkoutUrl?: string; error?: string }
      if (!res.ok) { setWashError(j.error ?? "Failed to start checkout. Please try again."); return }
      if (j.checkoutUrl) { window.location.href = j.checkoutUrl; return }
      setWashError("Unexpected response from server. Please try again.")
    } catch {
      setWashError("Network error. Please try again.")
    } finally {
      setWashSaving(false)
    }
  }

  const isEnterprise = tier === "enterprise"
  const isPlan       = !isEnterprise
  const plan         = isPlan ? tier as PlanKey : "professional" as PlanKey

  const isPro  = tier === "professional"
  const isPP   = tier === "professional_plus"
  const isEss  = tier === "essentials"

  const currentBands   = isPP ? PP_EMPLOYEE_BANDS : PRO_EMPLOYEE_BANDS
  const band           = isPlan ? getEmployeeBand(employeeCount, plan) : PRO_EMPLOYEE_BANDS[0]

  const pricing = isPlan ? calculatePrice({
    plan:              plan,
    employeeCount,
    locationCount,
    selectedModuleIds: Array.from(selectedModules),
    intelligenceSuite: suitePurchased,
    discountPercent:   discountPercent ?? undefined,
  }) : null

  // Enforcement: clamp employee count to plan max when switching tiers
  useEffect(() => {
    if (isEss && employeeCount > 25)   setEmployeeCount(25)
    if (isPro && employeeCount > 500)  setEmployeeCount(500)
    if (isPP  && employeeCount > 2500) setEmployeeCount(2500)
  }, [tier]) // eslint-disable-line react-hooks/exhaustive-deps

  // Enforce location max per plan
  useEffect(() => {
    if (isEss && locationCount > 1)    setLocationCount(1)
    if (isPro && locationCount > 15)   setLocationCount(15)
    if (isPP  && locationCount > 100)  setLocationCount(100)
  }, [tier]) // eslint-disable-line react-hooks/exhaustive-deps

  const recommendedTier: Tier =
    employeeCount > 500 || locationCount > 15 ? "professional_plus"
    : employeeCount > 25  || locationCount > 1 ? "professional"
    : "essentials"

  function toggleModule(id: ModuleId) {
    setSelectedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const scrollToModules = useCallback(() => {
    document.getElementById("modules-section")?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (highlightSection === "modules") setTimeout(scrollToModules, 400)
  }, [highlightSection, scrollToModules])

  async function handleCheckout() {
    if (isEnterprise) {
      window.location.href = "/book-demo"
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/subscription/checkout-intent", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan:              plan,
          employeeCount,
          locationCount,
          selectedModuleIds: Array.from(selectedModules),
          intelligenceSuite: suitePurchased || isPP,
        }),
      })
      const j = await res.json().catch(() => ({})) as { checkoutUrl?: string; error?: string }
      if (!res.ok) { setError(j.error ?? "Failed to start checkout. Please try again."); return }
      if (j.checkoutUrl) { window.location.href = j.checkoutUrl; return }
      setError("Unexpected response from server. Please try again.")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const locationIncluded  = isPlan ? PLANS[plan].includedLocations : 1
  const locationMax       = isPlan ? PLANS[plan].maxLocations : 1
  const locationPriceStr  = isPP ? "+$40/mo" : "+$50/mo"

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <RelayWordmark height={32} />
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Choose your Relay plan</h1>
        <p className="text-gray-500 mt-1">{orgName}</p>
      </div>

      {/* ── Wash Essentials ──────────────────────────────────────────────────── */}
      {isCarWash && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <Droplets className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-gray-900 text-lg">Wash Essentials</h2>
                <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 bg-blue-600 text-white rounded-full">
                  Car Wash
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Purpose-built for car wash operations · 1–7 locations
              </p>
            </div>
          </div>

          {/* Location stepper */}
          <div className="bg-white rounded-xl border border-blue-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-gray-900 text-sm">Locations</span>
              <span className="text-xs text-gray-500">1 included · +$10/mo each · max 7</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setWashLocationCount(n => Math.max(1, n - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              >
                −
              </button>
              <span className="text-xl font-bold text-gray-900 w-8 text-center">{washLocationCount}</span>
              <button
                type="button"
                onClick={() => setWashLocationCount(n => Math.min(7, n + 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              >
                +
              </button>
              <span className="text-sm text-gray-500">
                location{washLocationCount !== 1 ? "s" : ""}
                {washAdditional > 0 && (
                  <span className="text-gray-400"> · {washAdditional} additional @ +$10/mo each</span>
                )}
              </span>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="bg-white rounded-xl border border-blue-200 p-4 mb-4 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Wash Essentials base</span>
              <span className="text-gray-900">${washBase}/mo</span>
            </div>
            {washAdditional > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">+{washAdditional} additional location{washAdditional !== 1 ? "s" : ""}</span>
                <span className="text-gray-900">+${washAdditional * 10}/mo</span>
              </div>
            )}
            {washDiscountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                <div>
                  <span className="font-medium">{discountLabel ?? "Discount"}</span>
                  <span className="text-xs ml-2 text-green-600">({discountPercent}% off)</span>
                </div>
                <span className="font-semibold">−${washDiscountAmount}/mo</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
              <span className="font-bold text-gray-900">Monthly total</span>
              <span className="text-2xl font-bold text-gray-900">${washFinal}/mo</span>
            </div>
          </div>

          {washError && <p className="text-red-600 text-sm mb-3">{washError}</p>}

          <button
            type="button"
            onClick={handleWashCheckout}
            disabled={washSaving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {washSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <>Subscribe to Wash Essentials <ChevronRight className="w-4 h-4" /></>
            }
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Secured by Stripe · upgrade to Full Relay anytime
          </p>
        </div>
      )}

      {isCarWash && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
            or choose Full Relay — Wash Edition
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      {/* Plan tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {(["essentials", "professional", "professional_plus", "enterprise"] as Tier[]).map((t) => (
          <PlanCard
            key={t}
            tier={t}
            selected={tier === t}
            recommended={recommendedTier === t}
            onClick={() => setTier(t)}
          />
        ))}
      </div>

      {/* Enterprise CTA — no further config needed */}
      {isEnterprise && (
        <div className="bg-gray-900 rounded-2xl p-8 text-center mb-6">
          <Phone className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Let&rsquo;s talk</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
            Enterprise plans are customized to your organization&rsquo;s size and needs. Book a call or email our team to get started.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/book-demo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              <Phone className="w-4 h-4" />
              Schedule a Demo
            </a>
            <a
              href="mailto:info@getrelay.software?subject=Relay Enterprise Inquiry"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-xl text-sm hover:bg-gray-100 transition-colors"
            >
              Contact Sales <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Scaling config for Professional / Professional Plus */}
      {(isPro || isPP) && (
        <>
          {/* Employee count */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Employee count</h2>
              {isPP && <span className="text-xs text-gray-500">250 employees included</span>}
              {isPro && <span className="text-xs text-gray-500">50 employees included, max 500</span>}
            </div>

            <div className="flex items-center gap-4 mb-4">
              <input
                type="number"
                min={1}
                max={isPP ? 2500 : 500}
                value={employeeCount}
                onChange={e => setEmployeeCount(
                  Math.min(isPP ? 2500 : 500, Math.max(1, parseInt(e.target.value) || 1))
                )}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 text-sm">employees</span>
            </div>

            <div className={`grid gap-2 ${isPP ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-5"}`}>
              {currentBands.map((b) => (
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
              <p className="text-xs text-gray-500 mt-3">
                +${band.additionalCost}/mo employee scaling for {band.label} employees
              </p>
            )}
          </div>

          {/* Location count */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Locations</h2>
              <span className="text-xs text-gray-500">
                {locationIncluded} included · {locationPriceStr} per additional · max {locationMax}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setLocationCount(n => Math.max(locationIncluded, n - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              >
                −
              </button>
              <span className="text-lg font-semibold text-gray-900 w-8 text-center">{locationCount}</span>
              <button
                type="button"
                onClick={() => setLocationCount(n => Math.min(locationMax, n + 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
              >
                +
              </button>
              <span className="text-sm text-gray-500">
                location{locationCount !== 1 ? "s" : ""}
                {locationCount > locationIncluded && (
                  <span className="text-gray-400"> · {locationCount - locationIncluded} additional @ {locationPriceStr} each</span>
                )}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Essentials: employee count display + upgrade hint */}
      {isEss && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-700">Employee count</h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <input
              type="number"
              min={1}
              max={25}
              value={employeeCount}
              onChange={e => setEmployeeCount(Math.min(25, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500 text-sm">employees (max 25)</span>
          </div>
          <p className="text-xs text-gray-500">Need more than 25 employees or more than 1 location? Switch to Professional.</p>
          <button
            type="button"
            onClick={() => setTier("professional")}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            Switch to Professional <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Intelligence Modules (Professional only — optional add-ons) */}
      {isPro && (
        <div
          id="modules-section"
          className={`bg-white rounded-2xl border p-6 mb-5 transition-all ${
            highlightSection === "modules" ? "border-blue-400 shadow-md ring-2 ring-blue-200" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Intelligence Modules</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Optional add-ons</span>
          </div>
          <p className="text-xs text-gray-500 mb-5">Add AI-powered intelligence to specific areas of your operation.</p>

          {/* Intelligence Suite toggle */}
          <button
            type="button"
            onClick={() => { setSuitePurchased(!suitePurchased); if (!suitePurchased) setSelectedModules(new Set()) }}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 mb-4 transition-all ${
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
            <p className="text-lg font-bold text-gray-900">
              ${INTELLIGENCE_SUITE_PRICE}<span className="text-xs font-normal text-gray-500">/mo</span>
            </p>
          </button>

          {/* Individual modules */}
          <div className="space-y-2">
            {INTELLIGENCE_MODULES.map((mod) => {
              const active  = suitePurchased || selectedModules.has(mod.id)
              const inSuite = suitePurchased
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => !inSuite && toggleModule(mod.id)}
                  disabled={inSuite}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    inSuite        ? "border-indigo-200 bg-indigo-50/50 cursor-default opacity-75"
                    : active       ? "border-blue-500 bg-blue-50"
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
                    <span className="text-sm font-medium text-gray-800">{mod.label}</span>
                    {inSuite && <span className="text-xs text-indigo-500">(included in suite)</span>}
                  </div>
                  <span className="text-sm text-gray-600">${mod.price}/mo</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Professional Plus: Intelligence Suite included notice */}
      {isPP && (
        <div className="bg-purple-50 rounded-2xl border border-purple-200 p-5 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-purple-900">Intelligence Suite — Included</h2>
            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-medium">$199 value</span>
          </div>
          <p className="text-xs text-purple-700">
            All 5 Intelligence Modules (Issue, SOP, Asset, Benchmark, Purchase) are included in your Professional Plus subscription at no additional charge.
          </p>
        </div>
      )}

      {/* Essentials: modules locked */}
      {isEss && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-500">Intelligence Modules</h2>
            <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Professional plan required</span>
          </div>
          <p className="text-xs text-gray-400">Upgrade to Professional to add AI-powered intelligence modules to your subscription.</p>
          <button
            type="button"
            onClick={() => setTier("professional")}
            className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            Switch to Professional <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Price summary — non-Enterprise only */}
      {!isEnterprise && pricing && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Monthly total
          </h2>

          <div className="space-y-0.5 mb-3">
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-600">{PLANS[plan].label} base</span>
              <span className="text-gray-900">${pricing.basePrice}/mo</span>
            </div>
            <PriceRow label={`Employee scaling (${band.label})`}                amount={pricing.employeeScaling} />
            {(isPro || isPP) && (
              <PriceRow
                label={`Location scaling (${Math.max(0, locationCount - locationIncluded)} additional)`}
                amount={pricing.locationScaling}
              />
            )}
            {isPP && (
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600">Intelligence Suite</span>
                <span className="text-purple-600 font-medium">Included</span>
              </div>
            )}
            {isPro && (
              <PriceRow
                label={suitePurchased ? "Intelligence Suite" : "Intelligence Modules"}
                amount={pricing.moduleCost}
              />
            )}
          </div>

          {pricing.discountAmount > 0 && (
            <div className="border-t border-gray-100 pt-3 mb-3">
              <div className="flex items-center justify-between text-sm py-1 text-green-700 bg-green-50 px-3 rounded-lg">
                <div>
                  <span className="font-medium">{discountLabel ?? "Discount"}</span>
                  <span className="text-xs ml-2 text-green-600">({discountPercent}% off)</span>
                  {discountExpiresAt && (
                    <span className="text-xs ml-2 text-green-600">
                      locked until {new Date(discountExpiresAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>
                <span className="font-semibold">−${pricing.discountAmount}/mo</span>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
            <span className="font-bold text-gray-900">Total due monthly</span>
            <span className="text-2xl font-bold text-gray-900">${pricing.totalAfterDiscount}/mo</span>
          </div>
        </div>
      )}

      {/* Upgrade nudge if Professional is selected but count exceeds Professional limits */}
      {isPro && employeeCount >= 500 && (
        <div className="flex items-start gap-2 p-4 bg-purple-50 border border-purple-200 rounded-xl mb-5 text-sm text-purple-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-purple-500" />
          <div>
            <p className="font-semibold mb-0.5">At the Professional limit</p>
            <p className="text-xs">Professional supports up to 500 employees. For larger teams, upgrade to Professional Plus which includes 250 employees and scales to 2,500.</p>
            <button
              type="button"
              onClick={() => setTier("professional_plus")}
              className="mt-2 text-xs text-purple-700 font-semibold flex items-center gap-1 hover:text-purple-900"
            >
              Switch to Professional Plus <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* CTA */}
      {error && <p className="text-red-600 text-sm mb-3 text-center">{error}</p>}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-semibold rounded-2xl text-base transition-colors ${
          isEnterprise
            ? "bg-gray-900 hover:bg-gray-800 text-white"
            : isPP
            ? "bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white"
            : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
        }`}
      >
        {saving ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</>
        ) : isEnterprise ? (
          <>Contact Sales <ChevronRight className="w-5 h-5" /></>
        ) : (
          <>Continue to Secure Checkout <ChevronRight className="w-5 h-5" /></>
        )}
      </button>

      {!isEnterprise && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Secured by Stripe. Your payment info is never stored on our servers.
        </p>
      )}
    </div>
  )
}
