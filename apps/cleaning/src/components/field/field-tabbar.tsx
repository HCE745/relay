"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HomeIcon, ListChecksIcon, ClipboardListIcon, ChartBarIcon } from "@/components/ui/icons"

type Tab = { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }

// Mobile-first bottom navigation for cleaners. Big touch targets, labels under
// icons, active route highlighted. Only the tabs the org's plan enables are
// passed in by the layout, so this never links somewhere the user can't go.
export function FieldTabBar({ hasPerformance, hasSops }: { hasPerformance: boolean; hasSops: boolean }) {
  const pathname = usePathname()
  const tabs: Tab[] = [
    { href: "/today", label: "Today", Icon: HomeIcon },
    { href: "/my-reports", label: "Reports", Icon: ListChecksIcon },
    ...(hasSops ? [{ href: "/my-sops", label: "Procedures", Icon: ClipboardListIcon }] : []),
    ...(hasPerformance ? [{ href: "/my-work", label: "My work", Icon: ChartBarIcon }] : []),
  ]

  return (
    <nav className="pb-safe sticky bottom-0 z-10 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/")
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? "text-brand-700" : "text-slate-400"
              }`}
            >
              <t.Icon className="h-5 w-5" />
              {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
