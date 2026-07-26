"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, Receipt, Building2, Users, CreditCard, RefreshCw,
  BarChart3, ArrowLeftRight, Settings, LogOut, BookOpen, ChevronDown,
  TrendingUp, Droplets, MessageSquare, Repeat, CalendarClock, AlertTriangle,
  ClipboardCheck, LineChart, Shield, Package, Landmark, FlaskConical, Scale,
  FolderOpen, Plug, HelpCircle,
} from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTour } from "@/components/tour/TourProvider"

type Entity = { id: string; name: string; isConsolidationParent: boolean }

type Props = {
  entities: Entity[]
  selectedEntityId: string
  userName?: string | null
}

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  tourId?: string
}

type NavSection = {
  label?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tourId: "nav-dashboard" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/invoices",  label: "Invoices",  icon: FileText, tourId: "nav-invoices" },
      { href: "/customers", label: "Customers", icon: Users,    tourId: "nav-customers" },
    ],
  },
  {
    label: "Expenses",
    items: [
      { href: "/bills",           label: "Bills",           icon: Receipt,   tourId: "nav-bills" },
      { href: "/vendors",         label: "Vendors",         icon: Building2, tourId: "nav-vendors" },
      { href: "/purchase-orders", label: "Purchase Orders", icon: Package },
      { href: "/fixed-assets",    label: "Fixed Assets",    icon: Landmark },
    ],
  },
  {
    label: "Banking",
    items: [
      { href: "/banking",   label: "Banking",     icon: CreditCard, tourId: "nav-banking" },
      { href: "/reconcile", label: "Reconcile",   icon: RefreshCw,  tourId: "nav-reconcile" },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/reports",      label: "Reports",       icon: BarChart3, tourId: "nav-reports" },
      { href: "/budgets",      label: "Budgets",        icon: TrendingUp },
      { href: "/cashflow",     label: "Cash Flow",      icon: Droplets,  tourId: "nav-cashflow" },
      { href: "/recurring",    label: "Recurring",      icon: Repeat },
      { href: "/amortization", label: "Amortization",   icon: CalendarClock },
      { href: "/kpis",         label: "KPI Dashboard",  icon: LineChart },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { href: "/ask",       label: "Ask AI",         icon: MessageSquare, tourId: "nav-ask" },
      { href: "/scenarios", label: "Scenarios",      icon: FlaskConical,  tourId: "nav-scenarios" },
      { href: "/valuation", label: "Valuation",      icon: Scale,         tourId: "nav-valuation" },
      { href: "/packets",   label: "Report Packets", icon: FolderOpen },
    ],
  },
  {
    label: "Compliance",
    items: [
      { href: "/anomalies", label: "Anomalies",  icon: AlertTriangle },
      { href: "/close",     label: "Month-End",  icon: ClipboardCheck },
      { href: "/audit",     label: "Audit Trail", icon: Shield },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/accounts",     label: "Chart of Accounts", icon: BookOpen,       tourId: "nav-accounts" },
      { href: "/intercompany", label: "Intercompany",       icon: ArrowLeftRight, tourId: "nav-intercompany" },
      { href: "/integrations", label: "Integrations",       icon: Plug },
      { href: "/settings",     label: "Settings",           icon: Settings },
    ],
  },
]

export function Sidebar({ entities, selectedEntityId, userName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [entityOpen, setEntityOpen] = useState(false)
  const { startTour } = useTour()

  const selected = entities.find((e) => e.id === selectedEntityId) ?? entities[0]

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(href + "/")
  }

  async function switchEntity(id: string) {
    setEntityOpen(false)
    await fetch("/api/entities/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: id }),
    })
    router.refresh()
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 overflow-hidden"
      style={{ width: "var(--sidebar-width)", background: "var(--sidebar-bg)" }}
    >
      {/* Logo / brand */}
      <div
        className="flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: "var(--accent)" }}
          >
            H
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-none">HCE Books</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "#3B5270" }}>Accounting</p>
          </div>
        </div>
        <button
          onClick={startTour}
          title="Take the tour"
          className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: "#3B5270" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)" }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#3B5270" }}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Entity switcher — shown only when user has access to 2+ entities */}
      {entities.length > 1 && (
        <div
          className="px-3 py-2.5 relative"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <button
            data-tour="entity-switcher"
            onClick={() => setEntityOpen(!entityOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--sidebar-text)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span className="truncate">{selected?.name ?? "Select entity"}</span>
            <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1 opacity-50" />
          </button>
          {entityOpen && (
            <div
              className="absolute left-3 right-3 top-full mt-1 rounded-lg shadow-2xl z-50 overflow-hidden"
              style={{ background: "#0F2645", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {entities.map((e) => (
                <button
                  key={e.id}
                  onClick={() => switchEntity(e.id)}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    color: e.id === selectedEntityId ? "#93C5FD" : "var(--sidebar-text)",
                    fontWeight: e.id === selectedEntityId ? 600 : 400,
                  }}
                  onMouseEnter={(el) => { (el.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
                  onMouseLeave={(el) => { (el.currentTarget as HTMLElement).style.background = "transparent" }}
                >
                  {e.name}
                  {e.isConsolidationParent && (
                    <span className="ml-1 opacity-50">(consolidated)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav
        data-tour="sidebar-nav"
        className="flex-1 py-2 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && (
              <div className="sidebar-group-label">{section.label}</div>
            )}
            <div className="px-2 space-y-0.5 mb-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...(item.tourId ? { "data-tour": item.tourId } : {})}
                    className={`sidebar-item ${active ? "active" : ""}`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-2.5 space-y-1.5"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        <button
          onClick={startTour}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors"
          style={{
            color: "var(--sidebar-text)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text-hover)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)"; (e.currentTarget as HTMLElement).style.background = "transparent" }}
        >
          <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#3B7DD8" }} />
          Take the Tour
        </button>
        <div className="flex items-center justify-between px-2">
          <span className="text-xs truncate" style={{ color: "#3B5270" }}>{userName}</span>
          <button
            onClick={logout}
            title="Sign out"
            className="transition-colors p-0.5 rounded"
            style={{ color: "#3B5270" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)" }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#3B5270" }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
