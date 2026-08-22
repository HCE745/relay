"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  AlertCircle,
  Package,
  MapPin,
  Users,
  Building2,
  Wrench,
  Settings,
  Bell,
  LogOut,
  GitBranch,
  Archive,
  Lightbulb,
  ClipboardList,
  BarChart2,
  CalendarDays,
  BookOpen,
  ShoppingCart,
  Globe2,
  Building,
  Key,
  QrCode,
  Target,
  FileText,
  TrendingUp,
  CheckSquare,
  Clock,
  Radio,
  ClipboardCheck,
  Megaphone,
  PieChart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/lib/auth-actions"
import type { PageKey } from "@/lib/page-access"
import { RelayWordmarkWhite } from "@/components/logo"
import type { RecentlyViewedItem } from "@/components/layout/recently-viewed-tracker"
import { CARWASH_NAV_ITEMS, PROPERTY_NAV_ITEMS, MANUFACTURING_NAV_ITEMS, getIndustryNavItems, isIndustryNavFlat } from "@/lib/workspace-config"
import { resolveViewIcon, type CustomViewSidebarItem } from "@/lib/custom-view-config"
import type { CustomPageSidebarItem } from "@/lib/widget-registry"

const STATUS_BADGE: Record<string, string> = {
  OPEN:        "bg-blue-500",
  IN_PROGRESS: "bg-yellow-500",
  RESOLVED:    "bg-green-500",
  CLOSED:      "bg-gray-400",
  ESCALATED:   "bg-red-500",
  ACTIVE:      "bg-green-500",
  INACTIVE:    "bg-gray-400",
  MAINTENANCE: "bg-yellow-500",
}

const ALL_NAV_ITEMS: Array<{ key: PageKey; href: string; label: string; icon: React.ElementType; section: string }> = [
  { key: "dashboard",           href: "/dashboard",           label: "Dashboard",             icon: LayoutDashboard, section: "MAIN" },
  { key: "issues",              href: "/issues",              label: "Issues",                icon: AlertCircle,     section: "MAIN" },
  { key: "assignments",         href: "/assignments",         label: "Assignments",           icon: ClipboardCheck,  section: "MAIN" },
  { key: "communications",      href: "/communications",      label: "Communications",        icon: Radio,           section: "MAIN" },

  { key: "voice",               href: "/voice",               label: "Employee Voice",        icon: Megaphone,       section: "EMPLOYEE VOICE" },
  { key: "suggestions",         href: "/suggestions",         label: "Suggestions",           icon: Lightbulb,       section: "EMPLOYEE VOICE" },

  { key: "calendar",            href: "/calendar",            label: "Calendar",              icon: CalendarDays,    section: "OPERATIONS" },
  { key: "purchase-requests",   href: "/purchase-requests",   label: "Purchase Requests",     icon: ShoppingCart,    section: "OPERATIONS" },
  { key: "approval-intelligence", href: "/approval-intelligence", label: "Approval Intelligence", icon: CheckSquare, section: "OPERATIONS" },
  { key: "my-submissions",      href: "/my-submissions",      label: "My Submissions",        icon: ClipboardList,   section: "OPERATIONS" },
  { key: "sops",                href: "/sops",                label: "SOPs",                  icon: BookOpen,        section: "OPERATIONS" },
  { key: "assets",              href: "/assets",              label: "Assets",                icon: Package,         section: "OPERATIONS" },
  { key: "qr-codes",           href: "/qr-codes",            label: "QR Codes",              icon: QrCode,          section: "OPERATIONS" },
  { key: "locations",          href: "/locations",            label: "Locations",             icon: MapPin,          section: "OPERATIONS" },
  { key: "departments",         href: "/departments",         label: "Departments",           icon: Building2,       section: "OPERATIONS" },
  { key: "vendors",             href: "/vendors",             label: "Vendors",               icon: Wrench,          section: "OPERATIONS" },
  { key: "archive",             href: "/archive",             label: "Archive",               icon: Archive,         section: "OPERATIONS" },

  { key: "corporate-dashboard", href: "/corporate-dashboard", label: "Corporate View",        icon: Globe2,          section: "INTELLIGENCE" },
  { key: "regional-dashboard",  href: "/regional-dashboard",  label: "Regional View",         icon: Building,        section: "INTELLIGENCE" },
  { key: "analytics",           href: "/analytics",           label: "Analytics",             icon: BarChart2,       section: "INTELLIGENCE" },

  { key: "team",                href: "/team",                label: "Team",                  icon: Users,           section: "ADMINISTRATION" },
]

const SECTION_ORDER = ["MAIN", "EMPLOYEE VOICE", "OPERATIONS", "INTELLIGENCE", "ADMINISTRATION"]

interface SidebarProps {
  allowedPageKeys: PageKey[]
  showRouting: boolean
  industry?: string
  corporateDashboardEnabled?: boolean
  regionsEnabled?: boolean
  apiWebhooksEnabled?: boolean
  ssoEnabled?: boolean
  sharedFacilityEnabled?: boolean
  executiveBriefingsEnabled?: boolean
  executiveGoalsEnabled?: boolean
  trendDetectionEnabled?: boolean
  voiceInsightsVisible?: boolean
  navLabelOverrides?: Record<string, string>
  customViewItems?: CustomViewSidebarItem[]
  customPageItems?: CustomPageSidebarItem[]
}

export function Sidebar({
  allowedPageKeys,
  showRouting,
  industry,
  corporateDashboardEnabled,
  regionsEnabled,
  apiWebhooksEnabled,
  ssoEnabled,
  sharedFacilityEnabled,
  executiveBriefingsEnabled,
  executiveGoalsEnabled,
  trendDetectionEnabled,
  voiceInsightsVisible,
  navLabelOverrides,
  customViewItems = [],
  customPageItems = [],
}: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const allowedSet = new Set(allowedPageKeys)
  const industryNavItems = getIndustryNavItems(industry ?? "")
  const isFlat = isIndustryNavFlat(industry ?? "")
  const [recentItems, setRecentItems] = useState<RecentlyViewedItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchUnread() {
      try {
        const res = await fetch("/api/notifications")
        const arr = await res.json() as Array<{ isRead?: boolean }>
        if (!cancelled) setUnreadCount(Array.isArray(arr) ? arr.filter(n => !n.isRead).length : 0)
      } catch {}
    }
    fetchUnread()
    const iv = setInterval(fetchUnread, 30_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem("relay:recentlyViewed")
        if (raw) setRecentItems(JSON.parse(raw))
      } catch {}
    }
    load()
    window.addEventListener("storage", load)
    return () => window.removeEventListener("storage", load)
  }, [])

  const visibleNavItems = industryNavItems
    ? industryNavItems.filter(item => allowedSet.has(item.key))
    : ALL_NAV_ITEMS.filter(item => {
        if (!allowedSet.has(item.key)) return false
        if ((item.key === "corporate-dashboard" || item.key === "regional-dashboard") && !corporateDashboardEnabled) return false
        return true
      })

  const isActive = (href: string) => {
    const qIdx = href.indexOf("?")
    if (qIdx !== -1) {
      const hrefPath = href.slice(0, qIdx)
      if (pathname !== hrefPath) return false
      const hrefParams = new URLSearchParams(href.slice(qIdx + 1))
      for (const [k, v] of hrefParams) {
        if (searchParams.get(k) !== v) return false
      }
      return true
    }
    if (industryNavItems) {
      const hasSpecificMatch = industryNavItems.some(item => {
        const iqIdx = item.href.indexOf("?")
        if (iqIdx === -1 || item.href.slice(0, iqIdx) !== href) return false
        if (pathname !== href) return false
        const itemParams = new URLSearchParams(item.href.slice(iqIdx + 1))
        for (const [k, v] of itemParams) {
          if (searchParams.get(k) !== v) return false
        }
        return true
      })
      if (hasSpecificMatch) return false
    }
    return pathname === href || pathname.startsWith(href + "/")
  }

  const navLink = (href: string, label: string, Icon: React.ElementType, extra?: React.ReactNode) => (
    <div key={href} className="relative">
      <div className={cn(
        "absolute inset-y-0 left-0 w-0.5 rounded-r-full transition-colors",
        isActive(href) ? "bg-blue-400" : "bg-transparent"
      )} />
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 pl-4 pr-3 py-2 rounded-r-lg text-sm font-medium transition-colors",
          isActive(href)
            ? "bg-white/10 text-white"
            : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate flex-1">{label}</span>
        {extra}
      </Link>
    </div>
  )

  const voiceExtras = [
    voiceInsightsVisible && { href: "/voice/insights", label: "Voice Insights", icon: PieChart },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: React.ElementType }>

  const intelligenceExtras = [
    executiveBriefingsEnabled && { href: "/executive-briefings", label: "AI Briefings",  icon: FileText  },
    trendDetectionEnabled     && { href: "/trend-alerts",        label: "Trend Alerts",  icon: TrendingUp },
    executiveGoalsEnabled     && { href: "/executive-goals",     label: "Goals & KPIs",  icon: Target     },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: React.ElementType }>

  const adminExtras = [
    regionsEnabled                    && { href: "/regions",                  label: "Regions",          icon: MapPin    },
    showRouting                        && { href: "/settings/routing",         label: "Routing Rules",    icon: GitBranch },
    (apiWebhooksEnabled || ssoEnabled) && { href: "/settings/integrations",   label: "Integrations",     icon: Key       },
    sharedFacilityEnabled             && { href: "/settings/shared-facility", label: "Shared Facility",  icon: Building2 },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: React.ElementType }>

  const customViewExtras = allowedSet.has("issues")
    ? customViewItems.map(v => ({
        href:  `/issues?view=${v.id}`,
        label: v.name,
        icon:  resolveViewIcon(v.icon),
      }))
    : []

  const customPageExtras = customPageItems.map(p => ({
    href:  `/workspace/${p.id}`,
    label: p.name,
    icon:  resolveViewIcon(p.icon),
  }))

  const sectionExtras: Record<string, Array<{ href: string; label: string; icon: React.ElementType }>> = {
    MAIN:             [...customViewExtras, ...customPageExtras],
    "EMPLOYEE VOICE": voiceExtras,
    INTELLIGENCE:     intelligenceExtras,
    ADMINISTRATION:   adminExtras,
  }

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex-col">
      <div className="flex items-center px-6 py-5 border-b border-gray-800/80">
        <RelayWordmarkWhite height={28} />
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {isFlat ? (
          <div className="mb-4 space-y-0.5">
            {visibleNavItems.map(({ href, label, icon: Icon }) =>
              navLink(href, navLabelOverrides?.[href] ?? label, Icon)
            )}
            {allowedSet.has("issues") && customViewItems.map(view => {
              const Icon = resolveViewIcon(view.icon)
              return navLink(`/issues?view=${view.id}`, view.name, Icon)
            })}
            {customPageItems.map(page => {
              const Icon = resolveViewIcon(page.icon)
              return navLink(`/workspace/${page.id}`, page.name, Icon)
            })}
          </div>
        ) : (
          SECTION_ORDER.map(section => {
            const items = (visibleNavItems as Array<{ key: PageKey; href: string; label: string; icon: React.ElementType; section: string }>).filter(i => i.section === section)
            const extras = sectionExtras[section] ?? []
            if (items.length === 0 && extras.length === 0) return null

            return (
              <div key={section} className="mb-4">
                <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase px-4 mb-1 mt-1">
                  {section}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ href, label, icon: Icon }) => navLink(href, navLabelOverrides?.[href] ?? label, Icon))}
                  {extras.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
                </div>
              </div>
            )
          })
        )}

        {/* Settings + Notifications in Admin section at bottom */}
        <div className="mb-4">
          <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase px-4 mb-1">ACCOUNT</p>
          <div className="space-y-0.5">
            {navLink("/settings", "Settings", Settings)}
            <div className="relative">
              <div className={cn(
                "absolute inset-y-0 left-0 w-0.5 rounded-r-full transition-colors",
                isActive("/notifications") ? "bg-blue-400" : "bg-transparent"
              )} />
              <Link
                href="/notifications"
                className={cn(
                  "flex items-center gap-3 pl-4 pr-3 py-2 rounded-r-lg text-sm font-medium transition-colors",
                  isActive("/notifications")
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
                )}
              >
                <Bell className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Recently Viewed */}
        {recentItems.length > 0 && (
          <div className="mb-4 border-t border-gray-800/60 pt-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 mb-1">
              <Clock className="w-3 h-3" />
              Recent
            </p>
            <div className="space-y-0.5">
              {recentItems.map(item => (
                <div key={item.id} className="relative">
                  <div className={cn(
                    "absolute inset-y-0 left-0 w-0.5 rounded-r-full",
                    pathname === item.href ? "bg-blue-400" : "bg-transparent"
                  )} />
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 pl-4 pr-3 py-1.5 rounded-r-lg text-xs transition-colors",
                      pathname === item.href
                        ? "bg-white/10 text-white"
                        : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_BADGE[item.status] ?? "bg-gray-500")} />
                    <span className="truncate flex-1">{item.title}</span>
                    <span className="text-[10px] text-gray-600 flex-shrink-0">{item.type}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="px-2 py-3 border-t border-gray-800/60">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-r-lg text-sm font-medium text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Logout
          </button>
        </form>
      </div>
    </aside>
  )
}
