"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HomeIcon, CalendarIcon, ListChecksIcon, CircleIcon } from "@/components/ui/icons"

type Tab = { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }

// Mobile-first bottom navigation for cleaners. Four stable tabs; everything else
// (procedures, performance, clock history, supplies, notifications, help) lives
// on the "More" hub (/me), so the bar never changes shape by plan.
const TABS: Tab[] = [
  { href: "/today", label: "Today", Icon: HomeIcon },
  { href: "/my-schedule", label: "Schedule", Icon: CalendarIcon },
  { href: "/my-reports", label: "Reports", Icon: ListChecksIcon },
  { href: "/me", label: "More", Icon: CircleIcon },
]

export function FieldTabBar() {
  const pathname = usePathname()
  return (
    <nav className="pb-safe sticky bottom-0 z-10 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/")
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${active ? "text-brand-700" : "text-slate-400"}`}
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
