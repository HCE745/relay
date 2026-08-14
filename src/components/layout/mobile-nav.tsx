"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { logout } from "@/lib/auth-actions"
import {
  LayoutDashboard,
  AlertCircle,
  Lightbulb,
  Bell,
  Menu,
  X,
  ClipboardList,
  Package,
  MapPin,
  Building2,
  Wrench,
  Users,
  Settings,
  GitBranch,
  Archive,
  LogOut,
  Plus,
  BarChart2,
  BookOpen,
  ShoppingCart,
  ClipboardCheck,
  Radio,
  Droplets,
  QrCode,
} from "lucide-react"
import type { PageKey } from "@/lib/page-access"
import { RelayIconWhite, RelayWordmarkWhite } from "@/components/logo"
import { SupportButton } from "@/components/support/support-button"

const ALL_NAV_ITEMS: Array<{ key: PageKey; href: string; label: string; icon: React.ElementType }> = [
  { key: "dashboard",       href: "/dashboard",       label: "Dashboard",      icon: LayoutDashboard },
  { key: "issues",          href: "/issues",           label: "Issues",         icon: AlertCircle },
  { key: "assignments",     href: "/assignments",      label: "Assignments",    icon: ClipboardCheck },
  { key: "communications",  href: "/communications",   label: "Communications", icon: Radio },
  { key: "archive",         href: "/archive",           label: "Archive",        icon: Archive },
  { key: "my-submissions",  href: "/my-submissions",   label: "My Submissions", icon: ClipboardList },
  { key: "assets",          href: "/assets",            label: "Assets",         icon: Package },
  { key: "locations",       href: "/locations",         label: "Locations",      icon: MapPin },
  { key: "departments",     href: "/departments",       label: "Departments",    icon: Building2 },
  { key: "vendors",         href: "/vendors",           label: "Vendors",        icon: Wrench },
  { key: "team",            href: "/team",              label: "Team",           icon: Users },
  { key: "suggestions",     href: "/suggestions",       label: "Suggestions",    icon: Lightbulb },
  { key: "analytics",       href: "/analytics",         label: "Analytics",      icon: BarChart2 },
  { key: "sops",            href: "/sops",              label: "SOPs",           icon: BookOpen },
  { key: "purchase-requests", href: "/purchase-requests", label: "Purchases",   icon: ShoppingCart },
]

const CARWASH_NAV_ITEMS: Array<{ key: PageKey; href: string; label: string; icon: React.ElementType }> = [
  { key: "dashboard",  href: "/dashboard",                       label: "Wash Overview",    icon: Droplets },
  { key: "issues",     href: "/issues?category=CUSTOMER_REPORT", label: "Customer Reports", icon: ClipboardList },
  { key: "issues",     href: "/issues",                          label: "Issues",            icon: AlertCircle },
  { key: "issues",     href: "/issues?category=MAINTENANCE",     label: "Maintenance",       icon: Wrench },
  { key: "assets",     href: "/assets",                          label: "Equipment",         icon: Package },
  { key: "qr-codes",  href: "/qr-codes",                        label: "QR Codes",          icon: QrCode },
  { key: "locations",  href: "/locations",                       label: "Locations",         icon: MapPin },
  { key: "vendors",    href: "/vendors",                         label: "Vendors",           icon: Building2 },
  { key: "team",       href: "/team",                            label: "Team",              icon: Users },
  { key: "analytics",  href: "/analytics",                       label: "Reports",           icon: BarChart2 },
]

// Ordered prefix→title pairs (most-specific first)
const PAGE_LABELS: [string, string][] = [
  ["/issues/new",                              "Report Issue"],
  ["/issues/",                                 "Issue Detail"],
  ["/assets/",                                 "Asset Detail"],
  ["/settings/routing",                        "Routing Rules"],
  ["/assignments/new",                         "New Assignment"],
  ["/assignments/",                            "Assignment"],
  ["/communications/announcements/new",        "New Announcement"],
  ["/communications/announcements/",           "Announcement"],
  ["/communications/emergency",                "Emergency"],
  ["/communications/teams",                    "Team Channels"],
  ["/communications/announcements",            "Announcements"],
  ["/communications",                          "Communications"],
  ["/assignments",                             "Assignments"],
  ["/issues",                                  "Issues"],
  ["/dashboard",                               "Dashboard"],
  ["/archive",                                 "Archive"],
  ["/my-submissions",                          "My Submissions"],
  ["/assets",                                  "Assets"],
  ["/locations",                               "Locations"],
  ["/departments",                             "Departments"],
  ["/vendors",                                 "Vendors"],
  ["/team",                                    "Team"],
  ["/suggestions",                             "Suggestions"],
  ["/analytics",                               "Analytics"],
  ["/sops",                                    "SOPs"],
  ["/purchase-requests",                       "Purchase Requests"],
  ["/settings",                                "Settings"],
  ["/notifications",                           "Notifications"],
]

function getPageTitle(pathname: string): string {
  for (const [prefix, label] of PAGE_LABELS) {
    if (pathname === prefix || pathname.startsWith(prefix + "/") || (prefix.endsWith("/") && pathname.startsWith(prefix))) {
      return label
    }
  }
  return "Relay"
}

interface MobileNavProps {
  allowedPageKeys: PageKey[]
  showRouting: boolean
  industry?: string
  corporateDashboardEnabled?: boolean
  regionsEnabled?: boolean
  userName?: string
  orgName?: string
}

export function MobileNav({ allowedPageKeys, showRouting, industry, corporateDashboardEnabled, regionsEnabled, userName, orgName }: MobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const touchRef = useRef<{ startX: number; startY: number; edgeSwipe: boolean } | null>(null)

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  // Swipe right from left edge to open; swipe left anywhere to close
  useEffect(() => {
    const EDGE_WIDTH = 20  // px from screen left that counts as edge zone
    const MIN_SWIPE  = 40  // minimum horizontal distance to register as swipe

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      touchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        edgeSwipe: !drawerOpen && t.clientX < EDGE_WIDTH,
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!touchRef.current) return
      const { startX, startY, edgeSwipe } = touchRef.current
      touchRef.current = null
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY

      // Ignore swipes that are more vertical than horizontal
      if (Math.abs(dy) > Math.abs(dx)) return
      if (Math.abs(dx) < MIN_SWIPE) return

      if (!drawerOpen && edgeSwipe && dx > 0) {
        setDrawerOpen(true)
      } else if (drawerOpen && dx < 0) {
        setDrawerOpen(false)
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [drawerOpen])

  const allowedSet = new Set(allowedPageKeys)
  const isCarWash = industry === "Car Wash"
  const visibleItems = isCarWash
    ? CARWASH_NAV_ITEMS.filter(i => allowedSet.has(i.key))
    : ALL_NAV_ITEMS.filter((i) => {
        if (!allowedSet.has(i.key)) return false
        if (i.key === "corporate-dashboard" && !corporateDashboardEnabled) return false
        if (i.key === "regional-dashboard" && !corporateDashboardEnabled) return false
        return true
      })
  const pageTitle = getPageTitle(pathname)

  function isActive(href: string) {
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
    if (isCarWash) {
      const hasSpecificMatch = CARWASH_NAV_ITEMS.some(item => {
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
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"))
  }

  return (
    <>
      {/* ── Mobile Top Bar ──────────────────────────────────────────── */}
      <div
        className="md:hidden fixed inset-x-0 top-0 z-50 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-2"
        style={{ height: "calc(56px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-3 text-gray-400 hover:text-white active:text-white rounded-xl transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center">
            <RelayIconWhite size={14} />
          </div>
          <span className="text-white font-semibold text-sm">{pageTitle}</span>
        </div>

        <div className="flex items-center">
          <SupportButton
            userName={userName}
            orgName={orgName}
            triggerClassName="p-3 text-gray-400 hover:text-white active:text-white rounded-xl transition-colors"
          />
          <Link
            href="/notifications"
            className="p-3 text-gray-400 hover:text-white active:text-white rounded-xl transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* ── Slide-out Drawer ────────────────────────────────────────── */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-[60] flex",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-modal="true"
        role="dialog"
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawerOpen(false)}
        />

        {/* Panel */}
        <div
          className={cn(
            "relative flex flex-col bg-gray-900 shadow-2xl transition-transform duration-300 ease-out",
            "w-72 max-w-[85vw] h-full",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <RelayWordmarkWhite height={28} />
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav list */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overscroll-contain">
            {visibleItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-800 active:bg-gray-700",
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 pb-3 border-t border-gray-800 pt-3 space-y-0.5">
            {showRouting && (
              <Link
                href="/settings/routing"
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors",
                  pathname.startsWith("/settings/routing")
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-800",
                )}
              >
                <GitBranch className="w-5 h-5 flex-shrink-0" />
                Routing Rules
              </Link>
            )}
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors",
                pathname === "/settings"
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-800",
              )}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              Settings
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 active:bg-gray-700 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Bottom Tab Bar ──────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Home */}
        <Link
          href="/dashboard"
          className={cn(
            "flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-h-[56px] transition-colors",
            pathname === "/dashboard" ? "text-blue-600" : "text-gray-400",
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Assignments */}
        <Link
          href="/assignments"
          className={cn(
            "flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-h-[56px] transition-colors",
            isActive("/assignments") ? "text-blue-600" : "text-gray-400",
          )}
        >
          <ClipboardCheck className="w-5 h-5" />
          <span className="text-[10px] font-medium">Tasks</span>
        </Link>

        {/* Report Issue — elevated FAB */}
        <Link
          href="/issues/new"
          className="flex-1 flex flex-col items-center justify-center pt-2 pb-1 min-h-[56px] relative"
          aria-label="Report new issue"
        >
          <div className="w-12 h-12 -mt-5 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-transform">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <span className="text-[10px] font-medium text-gray-400 mt-0.5">Report</span>
        </Link>

        {/* Communications */}
        <Link
          href="/communications"
          className={cn(
            "flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-h-[56px] transition-colors",
            isActive("/communications") ? "text-blue-600" : "text-gray-400",
          )}
        >
          <Radio className="w-5 h-5" />
          <span className="text-[10px] font-medium">Comms</span>
        </Link>

        {/* More — opens drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-h-[56px] text-gray-400 transition-colors"
          aria-label="More navigation"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </>
  )
}
