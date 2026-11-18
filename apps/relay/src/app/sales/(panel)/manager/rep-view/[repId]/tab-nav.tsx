"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Building2, Briefcase, Mail, Bell, Activity, List, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "Overview",       suffix: "",                icon: LayoutDashboard },
  { label: "Prospects",      suffix: "/prospects",      icon: Building2 },
  { label: "Opportunities",  suffix: "/opportunities",  icon: Briefcase },
  { label: "Email",          suffix: "/email",          icon: Mail },
  { label: "Follow-Ups",     suffix: "/follow-ups",     icon: Bell },
  { label: "Activity",       suffix: "/activity",       icon: Activity },
  { label: "Research Lists", suffix: "/research-lists", icon: List },
  { label: "Performance",    suffix: "/performance",    icon: BarChart2 },
]

export function RepViewTabNav({ basePath }: { basePath: string }) {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1 border-b border-gray-800 px-5 overflow-x-auto">
      {TABS.map(tab => {
        const href = `${basePath}${tab.suffix}`
        const active = tab.suffix === ""
          ? pathname === basePath
          : pathname.startsWith(href)
        return (
          <Link
            key={tab.suffix}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              active
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600",
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
