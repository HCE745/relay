import Link from "next/link"
import { Lock, ChevronRight } from "lucide-react"

// Feature descriptions for each gated feature
const FEATURE_INFO: Record<string, { title: string; description: string }> = {
  assets:    { title: "Asset Management",    description: "Track equipment, tools, and assets across all your locations. Monitor status, maintenance schedules, and assign assets to departments." },
  vendors:   { title: "Vendor Management",   description: "Manage supplier relationships, track vendor contracts, and streamline procurement workflows." },
  analytics: { title: "Analytics & Insights",description: "Gain deep visibility into issue trends, resolution times, team performance, and operational health across your organization." },
  locations: { title: "Multiple Locations",  description: "Add and manage multiple locations, assign teams to sites, and get location-level reporting." },
  injuries:  { title: "Injury Reporting",    description: "Track workplace incidents, manage OSHA compliance, and route injury reports to the right safety contacts automatically." },
  sops:      { title: "SOP Management",      description: "Create and maintain Standard Operating Procedures, link them to issue types, and surface the right SOP when an issue is submitted." },
  "qr-codes":{ title: "QR Code Reporting",   description: "Generate QR codes for any location, area, or asset. Anyone can scan and submit a report without logging in — perfect for restrooms, dock doors, equipment, and shared spaces." },
  modules:   { title: "Intelligence Modules",description: "Add AI-powered intelligence to specific areas of your operation — issues, assets, SOPs, benchmarks, and purchasing." },
}

// Features that are not included in Wash Essentials but exist in full Relay
const WASH_ESSENTIALS_UPGRADE_INFO: Record<string, { title: string; description: string }> = {
  sops:      { title: "SOP Management",            description: "Create and maintain Standard Operating Procedures linked to issue types. Available in Full Relay — Wash Edition." },
  analytics: { title: "Advanced Analytics",        description: "Deep cross-location analytics, trend detection, and health scores. Available in Full Relay — Wash Edition." },
  modules:   { title: "Intelligence Modules",      description: "AI-powered intelligence for issues, assets, and operations. Available in Full Relay — Wash Edition." },
}

export function PlanGateContent({
  feature,
  upgradeHref = "/subscribe",
  productLine,
}: {
  feature: string
  upgradeHref?: string
  productLine?: string
}) {
  const isWashEssentialsPlan = productLine === "WASH_ESSENTIALS"

  if (isWashEssentialsPlan) {
    const washInfo = WASH_ESSENTIALS_UPGRADE_INFO[feature] ?? {
      title:       "Full Relay — Wash Edition",
      description: "This feature is available in Full Relay — Wash Edition.",
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
          <Lock className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{washInfo.title}</h2>
        <p className="text-gray-500 text-sm max-w-sm mb-6">{washInfo.description}</p>
        <p className="text-xs text-gray-400 mb-4">
          Your current plan is <strong>Wash Essentials</strong>.
          Upgrade to unlock the full Relay platform for your car wash.
        </p>
        <Link
          href={upgradeHref}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Upgrade to Full Relay Wash
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  const info = FEATURE_INFO[feature] ?? {
    title:       "Professional Feature",
    description: "This feature is available on the Relay Professional plan.",
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-5">
        <Lock className="w-6 h-6 text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{info.title}</h2>
      <p className="text-gray-500 text-sm max-w-sm mb-6">{info.description}</p>
      <p className="text-xs text-gray-400 mb-4">
        Available on <strong>Relay Professional</strong>. Your current plan is <strong>Essentials</strong>.
      </p>
      <Link
        href={upgradeHref}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        Upgrade to Professional
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
