"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { logout } from "@/lib/auth-actions"
import type { AdminNavItem } from "@/lib/rbac"
import {
  HomeIcon, CalendarIcon, BriefcaseIcon, BuildingIcon, MapPinIcon, UsersIcon, ClockIcon,
  ClipboardCheckIcon, AlertTriangleIcon, SparklesIcon, ReceiptIcon, FileTextIcon,
  CreditCardIcon, DollarIcon, ChartBarIcon, BoxIcon, TagIcon, CogIcon, CircleIcon,
} from "@/components/ui/icons"

// Icon per nav key — keeps the rail scannable and matches the app's icon system.
const NAV_ICON: Record<string, (p: { className?: string }) => React.ReactNode> = {
  dashboard: HomeIcon,
  schedule: CalendarIcon,
  jobs: BriefcaseIcon,
  customers: BuildingIcon,
  locations: MapPinIcon,
  team: UsersIcon,
  time: ClockIcon,
  coverage: AlertTriangleIcon,
  inspections: ClipboardCheckIcon,
  issues: AlertTriangleIcon,
  leads: SparklesIcon,
  estimates: ReceiptIcon,
  contracts: FileTextIcon,
  invoices: CreditCardIcon,
  payments: DollarIcon,
  "ar-aging": ChartBarIcon,
  profitability: ChartBarIcon,
  assets: BoxIcon,
  supplies: TagIcon,
  settings: CogIcon,
}

export function AdminSidebar({
  nav,
  user,
  packageTier,
}: {
  nav: AdminNavItem[]
  user: { name: string; role: string }
  packageTier: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
      {nav.map((item, i) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/")
        const showSection = !!item.section && item.section !== nav[i - 1]?.section
        const Icon = NAV_ICON[item.key] ?? CircleIcon
        return (
          <div key={item.key}>
            {showSection ? (
              <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {item.section}
              </div>
            ) : null}
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-700 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
              {item.label}
            </Link>
          </div>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-2 px-5 py-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
        C
      </div>
      <div>
        <div className="text-sm font-semibold text-white">HCE Cleaning</div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{packageTier}</div>
      </div>
    </div>
  )

  const footer = (
    <div className="border-t border-slate-800 px-4 py-3">
      <div className="mb-2 px-1 text-sm text-slate-300">
        <div className="font-medium text-white">{user.name}</div>
        <div className="text-xs text-slate-400">{user.role}</div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Sign out
        </button>
      </form>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-semibold text-slate-900">HCE Cleaning</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          aria-label="Toggle navigation"
        >
          Menu
        </button>
      </div>

      {/* Desktop fixed rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-900 md:flex">
        {brand}
        {links}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-900">
            {brand}
            {links}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  )
}
