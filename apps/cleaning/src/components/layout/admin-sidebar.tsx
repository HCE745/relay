"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { logout } from "@/lib/auth-actions"
import type { AdminNavItem } from "@/lib/rbac"
import {
  HomeIcon, CalendarIcon, BriefcaseIcon, BuildingIcon, MapPinIcon, UsersIcon, ClockIcon,
  ClipboardCheckIcon, ClipboardListIcon, AlertTriangleIcon, SparklesIcon, ReceiptIcon, FileTextIcon,
  CreditCardIcon, DollarIcon, ChartBarIcon, BoxIcon, TagIcon, CogIcon, CircleIcon, InboxIcon, SearchIcon,
  ListChecksIcon, ChevronLeftIcon, ChevronRightIcon,
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
  "pay-periods": DollarIcon,
  differentials: DollarIcon,
  coverage: AlertTriangleIcon,
  skills: SparklesIcon,
  kiosks: ClockIcon,
  compliance: ClipboardCheckIcon,
  access: TagIcon,
  inspections: ClipboardCheckIcon,
  issues: AlertTriangleIcon,
  "employee-reports": ListChecksIcon,
  sops: ClipboardListIcon,
  "service-areas": MapPinIcon,
  "service-requests": InboxIcon,
  satisfaction: ChartBarIcon,
  quotes: ClipboardListIcon,
  leads: SparklesIcon,
  estimates: ReceiptIcon,
  contracts: FileTextIcon,
  "work-orders": BriefcaseIcon,
  performance: ChartBarIcon,
  hiring: UsersIcon,
  onboarding: UsersIcon,
  invoices: CreditCardIcon,
  payments: DollarIcon,
  "ar-aging": ChartBarIcon,
  tax: ReceiptIcon,
  collections: DollarIcon,
  profitability: ChartBarIcon,
  "supply-spend": DollarIcon,
  "indirect-costs": ChartBarIcon,
  "labor-budgets": ChartBarIcon,
  exports: FileTextIcon,
  import: FileTextIcon,
  assets: BoxIcon,
  supplies: TagIcon,
  settings: CogIcon,
}

const NAV_COOKIE = "cln-nav"

export function AdminSidebar({
  nav,
  user,
  packageTier,
  initialCollapsed,
}: {
  nav: AdminNavItem[]
  user: { name: string; role: string }
  packageTier: string
  initialCollapsed: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  // Collapse persists in a cookie (read server-side next load → no flash) and is
  // applied instantly by flipping data-nav on the shell wrapper — no re-render of
  // the page tree, no layout jump beyond the CSS width transition.
  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    if (typeof document !== "undefined") {
      const shell = document.getElementById("admin-shell")
      if (shell) shell.dataset.nav = next ? "collapsed" : "expanded"
      document.cookie = `${NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`
    }
  }

  const links = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
      {nav.map((item, i) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/")
        const showSection = !!item.section && item.section !== nav[i - 1]?.section
        const Icon = NAV_ICON[item.key] ?? CircleIcon
        return (
          <div key={`${item.key}:${item.href}`}>
            {showSection ? (
              <div className="nav-collapsible px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {item.section}
              </div>
            ) : null}
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={`nav-link flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-700 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
              <span className="nav-collapsible">{item.label}</span>
            </Link>
          </div>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-2 px-5 py-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
        C
      </div>
      <div className="nav-collapsible">
        <div className="cln-display text-sm font-semibold text-white">HCE Cleaning</div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{packageTier}</div>
      </div>
    </div>
  )

  // Opens the command palette (also Cmd/Ctrl+K anywhere); dispatches a window
  // event the palette listens for, so no shared state is needed.
  const search = (
    <div className="px-3 pb-2">
      <button
        type="button"
        title="Search (⌘K)"
        onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("cln:open-palette")) }}
        className="nav-link flex w-full items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <span className="flex items-center gap-2"><SearchIcon className="h-[18px] w-[18px] shrink-0 text-slate-400" /> <span className="nav-collapsible">Search</span></span>
        <kbd className="nav-collapsible rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</kbd>
      </button>
    </div>
  )

  const footer = (
    <div className="border-t border-slate-800 px-4 py-3">
      <div className="nav-collapsible mb-2 px-1 text-sm text-slate-300">
        <div className="font-medium text-white">{user.name}</div>
        <div className="text-xs text-slate-400">{user.role}</div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          title="Sign out"
          className="nav-link w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <span className="nav-collapsible">Sign out</span>
          <span className="nav-collapsed-only" aria-hidden="true">⎋</span>
        </button>
      </form>
    </div>
  )

  // Desktop-only collapse control pinned under the brand.
  const collapseToggle = (
    <button
      type="button"
      onClick={toggleCollapsed}
      title={collapsed ? "Expand navigation" : "Collapse navigation"}
      aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      className="mx-3 mb-1 hidden items-center justify-center rounded-lg py-1.5 text-slate-400 hover:bg-white/10 hover:text-white md:flex"
    >
      {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
    </button>
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

      {/* Desktop fixed rail (width driven by data-nav on #admin-shell). */}
      <aside className="nav-rail fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 md:flex">
        {brand}
        {search}
        {links}
        {collapseToggle}
        {footer}
      </aside>

      {/* Mobile drawer (always full width; never collapsed). */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-900">
            {brand}
            {search}
            {links}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  )
}
