"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Link from "next/link"
import {
  LayoutDashboard, Users, Mail, Search, GitBranch, BarChart2,
  Settings, ChevronDown, ChevronRight, Menu, X, LogOut,
  Bell, FileText, Calendar, TrendingUp, Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href:  string
  icon:  React.ElementType
  badge?: number
  children?: NavItem[]
}

function buildSections(followUpsDue: number): { label?: string; items: NavItem[] }[] {
  return [
    {
      items: [
        { label: "Dashboard",       href: "/sales",                  icon: LayoutDashboard },
        { label: "Pipeline",        href: "/sales/pipeline",         icon: GitBranch },
        { label: "Leads",           href: "/sales/leads",            icon: Users },
        {
          label: "Outreach",
          href:  "/sales/outreach",
          icon:  Mail,
          children: [
            { label: "Email",       href: "/sales/outreach/email",       icon: Mail },
            { label: "Prospects",   href: "/sales/outreach/prospects",   icon: Search },
            { label: "Follow-Ups",  href: "/sales/outreach/follow-ups",  icon: Bell, badge: followUpsDue },
            { label: "Sequences",   href: "/sales/outreach/sequences",   icon: GitBranch },
            { label: "Templates",   href: "/sales/outreach/templates",   icon: FileText },
          ],
        },
      ],
    },
    {
      label: "Analytics",
      items: [
        { label: "Demo Analytics",  href: "/sales/demo-analytics",   icon: BarChart2 },
        { label: "Sales Analytics", href: "/sales/sales-analytics",  icon: TrendingUp },
      ],
    },
    {
      label: "Config",
      items: [
        { label: "Settings",        href: "/sales/settings",         icon: Settings },
        { label: "Follow-Up Stages", href: "/sales/settings/stages", icon: Layers },
      ],
    },
  ]
}

export function SalesSidebar({ name, email }: { name: string; email: string }) {
  const pathname       = usePathname()
  const router         = useRouter()
  const [open, setOpen]               = useState(false)
  const [outreachOpen, setOutreachOpen] = useState(false)
  const [followUpsDue, setFollowUpsDue] = useState(0)

  // Auto-open outreach if we're on an outreach sub-page
  useEffect(() => {
    if (pathname.startsWith("/sales/outreach")) setOutreachOpen(true)
  }, [pathname])

  // Poll follow-ups due count
  useEffect(() => {
    function load() {
      fetch("/api/sales/follow-ups/due-count")
        .then(r => r.ok ? r.json() : { count: 0 })
        .then((d: { count: number }) => setFollowUpsDue(d.count))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  async function logout() {
    await fetch("/api/sales/auth/logout", { method: "POST" })
    router.push("/sales/login")
  }

  const sections = buildSections(followUpsDue)

  function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
    const active = item.href === "/sales" || item.href === "/sales/outreach"
      ? pathname === item.href
      : pathname.startsWith(item.href) && (depth > 0 || !item.children)

    if (item.children) {
      return (
        <div>
          <button
            onClick={() => setOutreachOpen(v => !v)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              outreachOpen || pathname.startsWith("/sales/outreach")
                ? "text-white bg-gray-800"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60",
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {outreachOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {outreachOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-800 pl-2">
              {item.children.map(child => (
                <NavLink key={child.href} item={child} depth={1} />
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          active
            ? "bg-emerald-600/20 text-emerald-400"
            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60",
        )}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg tracking-tight">Relay</span>
          <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">
            Sales
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center shrink-0">
            <span className="text-emerald-400 text-xs font-bold">{name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{name}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div className={cn(
        "md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-gray-900 border-r border-gray-800 z-30">
        <SidebarContent />
      </div>
    </>
  )
}
