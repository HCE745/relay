"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronRight, Droplets, Factory, UtensilsCrossed, ShoppingBag, Building2, Wrench } from "lucide-react"
import { RelayWordmark } from "@/components/logo"

const INDUSTRIES = [
  {
    key: "Car Wash",
    label: "Car Wash",
    description: "Self-serve, automatic, and tunnel washes",
    icon: Droplets,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    featured: true,
    featureNote: "Includes QR customer reporting & asset tracking",
  },
  {
    key: "Manufacturing",
    label: "Manufacturing",
    description: "Plants, production lines, and facilities",
    icon: Factory,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    featured: false,
    featureNote: null,
  },
  {
    key: "Food & Beverage",
    label: "Food & Beverage",
    description: "Restaurants, cafes, and food production",
    icon: UtensilsCrossed,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    featured: false,
    featureNote: null,
  },
  {
    key: "Retail",
    label: "Retail",
    description: "Stores, warehouses, and distribution",
    icon: ShoppingBag,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    featured: false,
    featureNote: null,
  },
  {
    key: "Property Management",
    label: "Property Management",
    description: "Office buildings, apartments, and commercial real estate",
    icon: Building2,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    featured: false,
    featureNote: null,
  },
  {
    key: "Other",
    label: "Other / Custom",
    description: "Any other industry — customize everything",
    icon: Wrench,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
    featured: false,
    featureNote: null,
  },
]

export default function OnboardingIndustryPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  function proceed() {
    if (!selected) return
    // Pass the selected industry as a query param; the wizard reads it to pre-fill Step 1.
    router.push(`/onboarding?industry=${encodeURIComponent(selected)}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <RelayWordmark height={32} />
      </div>

      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">What kind of operation do you run?</h1>
          <p className="text-gray-500 text-sm">We&apos;ll tailor Relay to your industry from day one.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {INDUSTRIES.map(({ key, label, description, icon: Icon, iconBg, iconColor, featured, featureNote }) => {
            const isSelected = selected === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? "border-blue-600 bg-blue-50 shadow-sm"
                    : featured
                    ? "border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50/40"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{label}</span>
                      {featured && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 bg-blue-600 text-white rounded-full">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>
                    {featureNote && (
                      <p className="text-xs text-blue-600 font-medium mt-1">{featureNote}</p>
                    )}
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
          You can change this later in your organization settings.
        </p>
      </div>
    </div>
  )
}
