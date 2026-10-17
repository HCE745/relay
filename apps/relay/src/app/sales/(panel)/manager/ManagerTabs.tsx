"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "Overview",          href: "/sales/manager" },
  { label: "Time & Activity",   href: "/sales/manager/activity" },
  { label: "Duplicate Accounts", href: "/sales/manager/duplicates" },
  { label: "Commission Ledger",  href: "/sales/manager/commissions" },
]

export function ManagerTabs() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-1 border-b border-gray-800 mb-6 -mt-2">
      {TABS.map(tab => {
        const active = tab.href === "/sales/manager"
          ? pathname === tab.href
          : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              active
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
