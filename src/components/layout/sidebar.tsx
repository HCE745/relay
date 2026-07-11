"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/lib/auth-actions"
import type { PageKey } from "@/lib/page-access"
import { RelayWordmarkWhite } from "@/components/logo"
import type { RecentlyViewedItem } from "@/components/layout/recently-viewed-tracker"

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

const ALL_NAV_ITEMS: Array<{ key: PageKey; href: string; label: string; icon: React.ElementType }> = [
  { key: "dashboard",           href: "/dashboard",           label: "Dashboard",         icon: LayoutDashboard },
  { key: "corporate-dashboard", href: "/corporate-dashboard", label: "Corporate View",    icon: Globe2 },
  { key: "regional-dashboard",  href: "/regional-dashboard",  label: "Regional View",     icon: Building },
  { key: "issues",              href: "/issues",              label: "Issues",            icon: AlertCircle },
  { key: "assignments",         href: "/assignments",         label: "Assignments",       icon: ClipboardCheck },
  { key: "communications",      href: "/communications",      label: "Communications",    icon: Radio },
  { key: "archive",             href: "/archive",             label: "Archive",           icon: Archive },
  { key: "calendar",            href: "/calendar",            label: "Calendar",          icon: CalendarDays },
  { key: "purchase-requests",      href: "/purchase-requests",      label: "Purchase Requests",     icon: ShoppingCart },
  { key: "approval-intelligence",  href: "/approval-intelligence",  label: "Approval Intelligence", icon: CheckSquare },
  { key: "my-submissions",      href: "/my-submissions",      label: "My Submissions",    icon: ClipboardList },
  { key: "sops",                href: "/sops",                label: "SOPs",              icon: BookOpen },
  { key: "assets",              href: "/assets",              label: "Assets",            icon: Package },
  { key: "qr-codes",           href: "/qr-codes",            label: "QR Codes",          icon: QrCode },
  { key: "locations",          href: "/locations",            label: "Locations",         icon: MapPin },
  { key: "departments",         href: "/departments",         label: "Departments",       icon: Building2 },
  { key: "vendors",             href: "/vendors",             label: "Vendors",           icon: Wrench },
  { key: "team",                href: "/team",                label: "Team",              icon: Users },
  { key: "suggestions",         href: "/suggestions",         label: "Suggestions",       icon: Lightbulb },
  { key: "analytics",           href: "/analytics",           label: "Analytics",         icon: BarChart2 },
]

interface SidebarProps {
  allowedPageKeys: PageKey[]
  showRouting: boolean
  corporateDashboardEnabled?: boolean
  regionsEnabled?: boolean
  apiWebhooksEnabled?: boolean
  ssoEnabled?: boolean
  sharedFacilityEnabled?: boolean
  executiveBriefingsEnabled?: boolean
  executiveGoalsEnabled?: boolean
  trendDetectionEnabled?: boolean
}

export function Sidebar({
  allowedPageKeys,
  showRouting,
  corporateDashboardEnabled,
  regionsEnabled,
  apiWebhooksEnabled,
  ssoEnabled,
  sharedFacilityEnabled,
  executiveBriefingsEnabled,
  executiveGoalsEnabled,
  trendDetectionEnabled,
}: SidebarProps) {
  const pathname = usePathname()
  const allowedSet = new Set(allowedPageKeys)
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

  const visibleNavItems = ALL_NAV_ITEMS.filter(item => {
    if (!allowedSet.has(item.key)) return false
    if (item.key === "corporate-dashboard" && !corporateDashboardEnabled) return false
    if (item.key === "regional-dashboard" && !corporateDashboardEnabled) return false
    return true
  })

  const navLink = (href: string, label: string, Icon: React.ElementType) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        pathname === href || pathname.startsWith(href + "/")
          ? "bg-blue-600 text-white"
          : "text-gray-400 hover:text-white hover:bg-gray-800"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {label}
    </Link>
  )

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex-col">
      <div className="flex items-center px-6 py-5 border-b border-gray-800">
        <RelayWordmarkWhite height={30} />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </Link>
        ))}

        {recentItems.length > 0 && (
          <div className="pt-4 mt-2 border-t border-gray-800">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 mb-1">
              <Clock className="w-3 h-3" />
              Recently Viewed
            </p>
            {recentItems.map(item => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors group",
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:text-white hover:bg-gray-800"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    STATUS_BADGE[item.status] ?? "bg-gray-500"
                  )}
                />
                <span className="truncate flex-1">{item.title}</span>
                <span className={cn(
                  "text-[10px] flex-shrink-0 px-1 rounded",
                  pathname === item.href ? "text-blue-200" : "text-gray-600"
                )}>
                  {item.type}
                </span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800 space-y-0.5">
        {executiveBriefingsEnabled && navLink("/executive-briefings", "AI Briefings", FileText)}
        {trendDetectionEnabled && navLink("/trend-alerts", "Trend Alerts", TrendingUp)}
        {executiveGoalsEnabled && navLink("/executive-goals", "Goals & KPIs", Target)}
        {regionsEnabled && navLink("/regions", "Regions", MapPin)}
        {showRouting && navLink("/settings/routing", "Routing Rules", GitBranch)}
        {(apiWebhooksEnabled || ssoEnabled) && navLink("/settings/integrations", "Integrations", Key)}
        {sharedFacilityEnabled && navLink("/settings/shared-facility", "Shared Facility", Building2)}
        {navLink("/settings", "Settings", Settings)}
        <Link
          href="/notifications"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/notifications"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          )}
        >
          <Bell className="w-5 h-5 flex-shrink-0" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            Logout
          </button>
        </form>
      </div>
    </aside>
  )
}
