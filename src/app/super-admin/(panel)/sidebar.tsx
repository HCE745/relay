"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  Shield, LayoutDashboard, Building2, Users, Activity, LogOut, TrendingUp, Menu, X, Settings, HeartPulse, Bug, Lightbulb, PhoneCall, Tag, Headphones, Megaphone, Mail, Gift, ClipboardList,
} from "lucide-react"

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean; badge?: number }
type NavSection = { label?: string; items: NavItem[] }

function buildSections(emailUnread: number): NavSection[] {
  return [
    {
      items: [
        { href: "/super-admin",               label: "Overview",  icon: LayoutDashboard, exact: true },
        { href: "/super-admin/organizations",  label: "Customers", icon: Building2 },
      ],
    },
    {
      label: "CRM",
      items: [
        { href: "/super-admin/crm",                label: "Dashboard",        icon: LayoutDashboard, exact: true },
        { href: "/super-admin/crm/demo-calls",      label: "Demo Calls",       icon: PhoneCall },
        { href: "/super-admin/crm/email",           label: "Email",            icon: Mail, badge: emailUnread },
        { href: "/super-admin/crm/prospects",       label: "Prospects",        icon: Users },
        { href: "/super-admin/crm/follow-ups",      label: "Follow-Ups",       icon: ClipboardList },
        { href: "/super-admin/referrals",           label: "Referrals",        icon: Users },
        { href: "/super-admin/referral-program",    label: "Referral Program", icon: Gift },
        { href: "/super-admin/feature-requests",    label: "Feature Requests", icon: Lightbulb },
        { href: "/super-admin/support",             label: "Support Inbox",    icon: Headphones },
        { href: "/super-admin/crm/settings",        label: "Settings",         icon: Settings },
      ],
    },
    {
      label: "Platform",
      items: [
        { href: "/super-admin/broadcast",       label: "Broadcast",       icon: Megaphone },
        { href: "/super-admin/promotions",      label: "Promotions",      icon: Tag },
        { href: "/super-admin/users",           label: "SA Users",        icon: Users },
        { href: "/super-admin/bug-reports",     label: "Bug Reports",     icon: Bug },
        { href: "/super-admin/audit",           label: "Audit Log",       icon: Activity },
        { href: "/super-admin/insights",        label: "Insights",        icon: TrendingUp },
        { href: "/super-admin/platform-health", label: "Platform Health", icon: HeartPulse },
        { href: "/super-admin/settings",        label: "Settings",        icon: Settings },
      ],
    },
  ]
}

export function SuperAdminSidebar({ name, email }: { name: string; email: string }) {
  const pathname           = usePathname()
  const router             = useRouter()
  const [open, setOpen]    = useState(false)
  const [emailUnread, setEmailUnread] = useState(0)

  // Fetch unread email count on mount and every 60s
  useEffect(() => {
    async function fetchUnread() {
      try {
        const res  = await fetch("/api/super-admin/crm/emails?unread=true")
        const data = await res.json() as { count: number }
        setEmailUnread(data.count ?? 0)
      } catch { /* ignore */ }
    }
    void fetchUnread()
    const id = setInterval(fetchUnread, 60_000)
    return () => clearInterval(id)
  }, [])

  // Refresh unread when navigating away from the email page
  useEffect(() => {
    if (pathname !== "/super-admin/crm/email") {
      fetch("/api/super-admin/crm/emails?unread=true")
        .then(r => r.json())
        .then(d => setEmailUnread((d as { count: number }).count ?? 0))
        .catch(() => null)
    }
  }, [pathname])

  const sections = buildSections(emailUnread)

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
      <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-none">Relay</p>
            <p className="text-indigo-400 text-[10px] font-semibold uppercase tracking-wider mt-0.5">
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive(item)
                      ? "bg-indigo-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800",
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className={cn(
                      "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                      isActive(item) ? "bg-white/20 text-white" : "bg-indigo-600 text-white",
                    )}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 pb-4 border-t border-gray-800 pt-4">
        <div className="px-3 py-2 mb-2">
          <p className="text-white text-xs font-semibold truncate">{name}</p>
          <p className="text-gray-500 text-[11px] truncate">{email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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
      <div className="md:hidden fixed top-0 inset-x-0 z-50 flex items-center gap-3 px-4 h-14 bg-gray-900 border-b border-gray-800">
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
          "fixed inset-y-0 left-0 w-60 bg-gray-900 border-r border-gray-800 flex flex-col z-50 transition-transform duration-200",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
