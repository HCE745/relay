import Link from "next/link"
import { Lock } from "lucide-react"

const PLAN_DISPLAY: Record<string, string> = {
  professional:      "Professional",
  professional_plus: "Professional Plus",
  enterprise:        "Enterprise",
}

interface FeatureGateProps {
  enabled:      boolean
  feature:      string
  planRequired: "professional" | "professional_plus" | "enterprise"
  children:     React.ReactNode
  compact?:     boolean
}

export function FeatureGate({ enabled, feature, planRequired, children, compact = false }: FeatureGateProps) {
  if (enabled) return <>{children}</>
  return <UpgradePrompt feature={feature} planRequired={planRequired} compact={compact} />
}

interface UpgradePromptProps {
  feature:      string
  planRequired: "professional" | "professional_plus" | "enterprise"
  compact?:     boolean
}

export function UpgradePrompt({ feature, planRequired, compact = false }: UpgradePromptProps) {
  const planName = PLAN_DISPLAY[planRequired] ?? planRequired

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{feature} — available on <strong className="text-gray-700 dark:text-gray-300">{planName}</strong></span>
        <Link
          href="/settings/billing"
          className="ml-auto text-xs text-blue-600 hover:underline flex-shrink-0"
        >
          Upgrade
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-gray-400" />
      </div>
      <p className="font-semibold text-gray-900 dark:text-white mb-1">{feature}</p>
      <p className="text-sm text-gray-500 mb-4">
        Available on the <strong className="text-gray-700 dark:text-gray-300">{planName}</strong> plan
      </p>
      <Link
        href="/settings/billing"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        View subscription options
      </Link>
    </div>
  )
}
