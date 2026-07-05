"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, Receipt, Building2, Users, CreditCard, RefreshCw,
  BarChart3, ArrowLeftRight, Settings, LogOut, BookOpen, ChevronDown,
  TrendingUp, Droplets, MessageSquare, Repeat, CalendarClock, AlertTriangle, ClipboardCheck,
  LineChart, Shield, Package, Landmark, FlaskConical, Scale, FolderOpen, Plug,
} from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Entity = { id: string; name: string; isConsolidationParent: boolean }

type Props = {
  entities: Entity[]
  selectedEntityId: string
  userName?: string | null
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText, group: "Sales" },
  { href: "/customers", label: "Customers", icon: Users, group: "Sales" },
  { href: "/bills", label: "Bills", icon: Receipt, group: "Expenses" },
  { href: "/vendors", label: "Vendors", icon: Building2, group: "Expenses" },
  { href: "/banking", label: "Banking", icon: CreditCard },
  { href: "/reconcile", label: "Reconcile", icon: RefreshCw },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/budgets", label: "Budgets", icon: TrendingUp, group: "Planning" },
  { href: "/cashflow", label: "Cash Flow", icon: Droplets, group: "Planning" },
  { href: "/recurring", label: "Recurring", icon: Repeat, group: "Planning" },
  { href: "/amortization", label: "Amortization", icon: CalendarClock, group: "Planning" },
  { href: "/kpis", label: "KPI Dashboard", icon: LineChart, group: "Planning" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: Package, group: "Expenses" },
  { href: "/fixed-assets", label: "Fixed Assets", icon: Landmark, group: "Expenses" },
  { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { href: "/close", label: "Month-End", icon: ClipboardCheck },
  { href: "/audit", label: "Audit Trail", icon: Shield },
  { href: "/ask", label: "Ask AI", icon: MessageSquare },
  { href: "/scenarios", label: "Scenarios", icon: FlaskConical },
  { href: "/valuation", label: "Valuation", icon: Scale },
  { href: "/packets", label: "Report Packets", icon: FolderOpen },
  { href: "/accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/intercompany", label: "Intercompany", icon: ArrowLeftRight },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar({ entities, selectedEntityId, userName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [entityOpen, setEntityOpen] = useState(false)

  const selected = entities.find((e) => e.id === selectedEntityId) ?? entities[0]

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
    <div className="flex flex-col h-full bg-gray-900 text-white w-60 flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">H</div>
          <span className="font-bold text-white">HCE Books</span>
        </div>
      </div>

      {/* Entity switcher */}
      <div className="px-3 py-3 border-b border-gray-700 relative">
        <button
          onClick={() => setEntityOpen(!entityOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-200 transition-colors"
        >
          <span className="truncate">{selected?.name ?? "Select entity"}</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
        </button>
        {entityOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
            {entities.map((e) => (
              <button
                key={e.id}
                onClick={() => switchEntity(e.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${e.id === selectedEntityId ? "text-blue-400 font-medium" : "text-gray-300"}`}
              >
                {e.name}
                {e.isConsolidationParent && <span className="ml-1 text-xs text-gray-500">(consolidated)</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${active ? "active" : ""}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-700">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-gray-400 truncate">{userName}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white transition-colors ml-2">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
