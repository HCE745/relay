"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Shield, LayoutDashboard, Building2, Users, Activity, LogOut, TrendingUp, Menu, X, Settings, HeartPulse, Bug, Lightbulb, Tag, Headphones, Megaphone, Gift, ExternalLink,
} from "lucide-react"

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean }
type NavSection = { label?: string; items: NavItem[] }

function buildSections(): NavSection[] {
  return [
    {
      items: [
        { href: "/super-admin",              label: "Overview",  icon: LayoutDashboard, exact: true },
        { href: "/super-admin/organizations", label: "Customers", icon: Building2 },
      ],
    },
    {
      label: "Platform",
      items: [
        { href: "/super-admin/broadcast",       label: "Broadcast",       icon: Megaphone },
        { href: "/super-admin/promotions",      label: "Promotions",      icon: Tag },
        { href: "/super-admin/users",           label: "SA Users",        icon: Users },
        { href: "/super-admin/bug-reports",     label: "Bug Reports",     icon: Bug },
        { href: "/super-admin/feature-requests",label: "Feature Requests",icon: Lightbulb },
        { href: "/super-admin/audit",           label: "Audit Log",       icon: Activity },
        { href: "/super-admin/insights",        label: "Insights",        icon: TrendingUp },
        { href: "/super-admin/platform-health", label: "Platform Health", icon: HeartPulse },
        { href: "/super-admin/settings",        label: "Settings",        icon: Settings },
      ],
    },
    {
      label: "Sales Config",
      items: [
        { href: "/super-admin/support",          label: "Support Inbox",   icon: Headphones },
        { href: "/super-admin/referral-program", label: "Referral Program",icon: Gift },
        { href: "/super-admin/crm/settings",     label: "CRM Settings",    icon: Settings },
      ],
    },
  ]
}

export function SuperAdminSidebar({ name, email }: { name: string; email: string }) {
  const pathname           = usePathname()
  const router             = useRouter()
  const [open, setOpen]    = useState(false)

  const sections = buildSections()

  async function handleLogout() {
    await fetch("/api/super-admin/auth/logout", { method: "POST" })
    router.push("/super-admin/login")
  }

  function isActive({ href, exact }: NavItem) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  function close() { setOpen(false) }

  const sidebarContent = (
    <>
      {/* Branding */}
      <div className="px-5 py-4 border-b border-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-bold leading-none">Relay</p>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase tracking-widest leading-none">
                ADMIN
              </span>
            </div>
            <p className="text-indigo-400/80 text-[10px] font-medium uppercase tracking-wider mt-0.5">
              Control Panel
            </p>
          </div>
        </div>
        <button
          onClick={close}
          className="md:hidden text-gray-500 hover:text-white p-1"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Sales Dashboard shortcut */}
        <Link
          href="/sales"
          onClick={close}
          className="flex items-center gap-3 px-3 py-2 mb-3 rounded-lg text-sm font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-900/50 transition-colors"
        >
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Sales Dashboard</span>
        </Link>

        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-4" : ""}>
            {section.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive(item)
                      ? "bg-indigo-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5",
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 pb-4 border-t border-gray-900 pt-4">
        <div className="px-3 py-2 mb-2">
          <p className="text-white text-xs font-semibold truncate">{name}</p>
          <p className="text-gray-500 text-[11px] truncate">{email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top header bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 flex items-center gap-3 px-4 h-14 bg-[#0b1120] border-b border-gray-900">
        <button
          onClick={() => setOpen(true)}
          className="text-gray-400 hover:text-white p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span className="text-white text-sm font-bold">Control Panel</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={close}
          aria-hidden
        />
      )}

      {/* Sidebar — always visible on desktop, slide-in on mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-60 bg-[#0b1120] border-r border-gray-900 flex flex-col z-50 transition-transform duration-200",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
