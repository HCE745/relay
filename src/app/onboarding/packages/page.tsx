"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
import { ChevronLeft, ChevronRight, Droplets, Layers } from "lucide-react"
import { RelayWordmark } from "@/components/logo"

const PACKAGES = [
  {
    key: "wash_essentials",
    label: "Wash Essentials",
    tagline: "Purpose-built for car wash operations",
    price: "$40/mo",
    priceSub: "+ $10/mo per additional location (up to 7 locations)",
    description:
      "Issue tracking, QR reporting, asset management, and team coordination — everything a car wash needs, nothing it doesn't.",
    features: [
      "Issue Reporting & Tracking",
      "QR Customer Reporting",
      "Asset & Equipment Management",
      "1–7 Locations ($10/mo each after 1st)",
      "Team Roles & Permissions",
      "Mobile App (PWA)",
    ],
    icon:     Droplets,
    iconBg:   "bg-blue-100",
    iconColor:"text-blue-600",
    accent:   "border-blue-600 bg-blue-50",
    badge:    "Recommended",
    badgeCls: "bg-blue-600 text-white",
  },
  {
    key: "full_relay",
    label: "Full Relay — Wash Edition",
    tagline: "Full Relay platform tailored for Car Wash",
    price: "From $149/mo",
    priceSub: "Standard Relay plans · billed by employee count",
    description:
      "Unlimited locations, vendors, purchase approvals, advanced analytics, and Intelligence Modules. Same platform used by manufacturing plants and property portfolios.",
    features: [
      "Everything in Wash Essentials",
      "Unlimited Locations",
      "Vendor Management",
      "Purchase Approval Workflows",
      "Advanced Analytics",
      "Intelligence Modules (AI add-ons)",
    ],
    icon:     Layers,
    iconBg:   "bg-purple-100",
    iconColor:"text-purple-600",
    accent:   "border-purple-400 bg-purple-50/40",
    badge:    null,
    badgeCls: "",
  },
]

function PackagesContent() {
  const router = useRouter()
  const params = useSearchParams()
  const industry = params.get("industry") ?? "Car Wash"
  const [selected, setSelected] = useState<string | null>(null)

  function proceed() {
    if (!selected) return
    const base = `/onboarding?industry=${encodeURIComponent(industry)}`
    if (selected === "wash_essentials") {
      router.push(`${base}&plan=wash_essentials`)
    } else {
      router.push(base)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <RelayWordmark height={32} />
      </div>

      <div className="w-full max-w-2xl">
        <button
          type="button"
          onClick={() => router.push("/onboarding/industry")}
          className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to industry selection
        </button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose your Car Wash package</h1>
          <p className="text-gray-500 text-sm">
            Start lean with Wash Essentials, or go full-featured with the complete Relay platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {PACKAGES.map(({ key, label, tagline, price, priceSub, description, features, icon: Icon, iconBg, iconColor, accent, badge, badgeCls }) => {
            const isSelected = selected === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`text-left p-5 rounded-2xl border-2 transition-all h-full ${
                  isSelected ? accent : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{label}</span>
                      {badge && (
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${badgeCls}`}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{tagline}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${
                    isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                  }`}>
                    {isSelected && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-lg font-bold text-gray-900">{price}</p>
                  <p className="text-xs text-gray-400">{priceSub}</p>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed mb-3">{description}</p>

                <ul className="space-y-1">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={proceed}
          disabled={!selected}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          You can upgrade from Wash Essentials to Full Relay at any time from your subscription settings.
        </p>
      </div>
    </div>
  )
}

export default function OnboardingPackagesPage() {
  return (
    <Suspense>
      <PackagesContent />
    </Suspense>
  )
}
