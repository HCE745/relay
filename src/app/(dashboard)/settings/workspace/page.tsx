import { redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { getIndustryNavItems, PLATFORM_DEFAULTS, type TermKey } from "@/lib/workspace-config"
import { WorkspaceSettingsClient } from "./workspace-settings-client"
import { Filter } from "lucide-react"

export const dynamic = "force-dynamic"

const TERM_KEYS: Array<{ key: TermKey; label: string; group: "singular" | "plural" }> = [
  { key: "issueSingular",      label: "Issue (singular)",      group: "singular" },
  { key: "issuePlural",        label: "Issue (plural)",        group: "plural"   },
  { key: "assetSingular",      label: "Asset (singular)",      group: "singular" },
  { key: "assetPlural",        label: "Asset (plural)",        group: "plural"   },
  { key: "locationSingular",   label: "Location (singular)",   group: "singular" },
  { key: "locationPlural",     label: "Location (plural)",     group: "plural"   },
  { key: "departmentSingular", label: "Department (singular)", group: "singular" },
  { key: "departmentPlural",   label: "Department (plural)",   group: "plural"   },
  { key: "vendorSingular",     label: "Vendor (singular)",     group: "singular" },
  { key: "vendorPlural",       label: "Vendor (plural)",       group: "plural"   },
]

export default async function WorkspaceSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/settings")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      industry: true,
      productLine: true,
      navigationConfig: true,
      terminologyConfig: true,
    },
  })

  if (!org) redirect("/settings")

  if (isWashEssentials(org.productLine ?? "RELAY_STANDARD")) {
    return (
      <div>
        <Header title="Workspace" />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-500 text-sm">Workspace customization is available on Full Relay editions.</p>
        </div>
      </div>
    )
  }

  const industry = org.industry ?? ""
  const industryNavItems = getIndustryNavItems(industry)

  const navConfig = (org.navigationConfig ?? {}) as { labelOverrides?: Record<string, string> }
  const termConfig = (org.terminologyConfig ?? {}) as Record<string, string>

  // Build nav item descriptors for the UI
  const navItemsForUI = industryNavItems
    ? industryNavItems.map(item => ({
        href: item.href,
        defaultLabel: item.label,
        currentLabel: navConfig.labelOverrides?.[item.href] ?? item.label,
      }))
    : null  // generic Relay nav — not customizable via href map in Phase 2

  // Resolve current term values (org override → industry default → platform default)
  const termItems = TERM_KEYS.map(({ key, label, group }) => ({
    key,
    label,
    group,
    platformDefault: PLATFORM_DEFAULTS[key],
    currentValue: termConfig[key] ?? "",
  }))

  return (
    <div>
      <Header title="Workspace" />
      {/* Custom Views entry point */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link
          href="/settings/workspace/views"
          className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 mb-2 hover:border-blue-300 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Filter className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Custom Views</p>
              <p className="text-xs text-gray-500">Saved filtered issue views, optionally pinned to the sidebar</p>
            </div>
          </div>
          <span className="text-gray-400 text-sm">→</span>
        </Link>
      </div>
      <WorkspaceSettingsClient
        industry={industry}
        navItems={navItemsForUI}
        termItems={termItems}
        initialNavConfig={navConfig}
        initialTermConfig={termConfig}
      />
    </div>
  )
}
