import Link from "next/link"
import {
  CalendarIcon, ReceiptIcon, ClipboardCheckIcon, ClockIcon, CreditCardIcon, BuildingIcon,
} from "@/components/ui/icons"

export type QuickAction = { key: string; label: string; href: string; icon: keyof typeof ICONS }

const ICONS = {
  schedule: CalendarIcon,
  estimate: ReceiptIcon,
  inspection: ClipboardCheckIcon,
  time: ClockIcon,
  invoice: CreditCardIcon,
  customer: BuildingIcon,
}

// Operational shortcuts on the dashboard. The caller passes only the actions the
// user's role + plan allow, so every tile is reachable.
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = ICONS[a.icon]
        return (
          <Link
            key={a.key}
            href={a.href}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:-translate-y-0.5 hover:border-brand hover:text-brand-800 hover:shadow-sm"
          >
            <Icon className="h-4 w-4 text-slate-400" />
            {a.label}
          </Link>
        )
      })}
    </div>
  )
}
