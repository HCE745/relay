import type { ElementType } from "react"
import type { PageKey } from "@/lib/page-access"
import {
  LayoutDashboard,
  AlertCircle,
  Package,
  MapPin,
  Users,
  Building2,
  Wrench,
  BarChart2,
  BookOpen,
  QrCode,
  ClipboardList,
  MessageSquare,
  HardHat,
  Droplets,
  Lightbulb,
  Megaphone,
  Globe2,
  Building,
  LayoutGrid,
  ClipboardCheck,
  Radio,
  Award,
  CalendarDays,
  ShoppingCart,
  CheckSquare,
  Archive,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavItem {
  key: PageKey
  href: string
  label: string
  icon: ElementType
  section: string
}

export interface MasterNavItem {
  key: PageKey
  defaultLabel: string
  href: string
  icon: ElementType
  section: string
  /** When set, item is filtered out unless the matching feature flag is true */
  requiredFeatureFlag?: "corporateDashboardEnabled"
}

interface IndustryConfig {
  mainItems: NavItem[]
  /** PageKeys to exclude from MASTER_NAV_ITEMS in this industry */
  excludedKeys?: PageKey[]
  /** href → label overrides applied to MASTER_NAV_ITEMS entries */
  labelOverrides?: Record<string, string>
}

// ── Master nav (add new items here — they auto-appear in all industry navs) ───

export const MASTER_NAV_ITEMS: MasterNavItem[] = [
  // ── OPERATIONS ────────────────────────────────────────────────────────────
  { key: "assignments",           defaultLabel: "Assignments",           href: "/assignments",           icon: ClipboardCheck, section: "OPERATIONS"     },
  { key: "communications",        defaultLabel: "Communications",        href: "/communications",        icon: Radio,          section: "OPERATIONS"     },
  { key: "assets",                defaultLabel: "Assets",                href: "/assets",                icon: Package,        section: "OPERATIONS"     },
  { key: "qr-codes",              defaultLabel: "QR Codes",              href: "/qr-codes",              icon: QrCode,         section: "OPERATIONS"     },
  { key: "locations",             defaultLabel: "Locations",             href: "/locations",             icon: MapPin,         section: "OPERATIONS"     },
  { key: "departments",           defaultLabel: "Departments",           href: "/departments",           icon: Building2,      section: "OPERATIONS"     },
  { key: "vendors",               defaultLabel: "Vendors",               href: "/vendors",               icon: Building2,      section: "OPERATIONS"     },
  { key: "sops",                  defaultLabel: "SOPs",                  href: "/sops",                  icon: BookOpen,       section: "OPERATIONS"     },
  { key: "calendar",              defaultLabel: "Calendar",              href: "/calendar",              icon: CalendarDays,   section: "OPERATIONS"     },
  { key: "purchase-requests",     defaultLabel: "Purchase Requests",     href: "/purchase-requests",     icon: ShoppingCart,   section: "OPERATIONS"     },
  { key: "approval-intelligence", defaultLabel: "Approval Intelligence", href: "/approval-intelligence", icon: CheckSquare,    section: "OPERATIONS"     },
  { key: "my-submissions",        defaultLabel: "My Submissions",        href: "/my-submissions",        icon: ClipboardList,  section: "OPERATIONS"     },
  { key: "archive",               defaultLabel: "Archive",               href: "/archive",               icon: Archive,        section: "OPERATIONS"     },
  // ── EMPLOYEE VOICE ────────────────────────────────────────────────────────
  { key: "voice",                 defaultLabel: "Employee Voice",        href: "/voice",                 icon: Megaphone,      section: "EMPLOYEE VOICE" },
  { key: "suggestions",           defaultLabel: "Suggestions",           href: "/suggestions",           icon: Lightbulb,      section: "EMPLOYEE VOICE" },
  { key: "surveys",               defaultLabel: "Surveys",               href: "/surveys",               icon: ClipboardList,  section: "EMPLOYEE VOICE" },
  { key: "recognition",           defaultLabel: "Recognition",           href: "/recognition",           icon: Award,          section: "EMPLOYEE VOICE" },
  // ── INTELLIGENCE ──────────────────────────────────────────────────────────
  { key: "analytics",             defaultLabel: "Reports",               href: "/analytics",             icon: BarChart2,      section: "INTELLIGENCE"   },
  { key: "analytics-dashboard",   defaultLabel: "Dashboard",             href: "/analytics/dashboard",   icon: LayoutGrid,     section: "INTELLIGENCE"   },
  { key: "corporate-dashboard",   defaultLabel: "Corporate View",        href: "/corporate-dashboard",   icon: Globe2,         section: "INTELLIGENCE",  requiredFeatureFlag: "corporateDashboardEnabled" },
  { key: "regional-dashboard",    defaultLabel: "Regional View",         href: "/regional-dashboard",    icon: Building,       section: "INTELLIGENCE",  requiredFeatureFlag: "corporateDashboardEnabled" },
  // ── ADMINISTRATION ────────────────────────────────────────────────────────
  { key: "team",                  defaultLabel: "Team",                  href: "/team",                  icon: Users,          section: "ADMINISTRATION" },
]

// ── Industry configs (exclusion + label-override lists only) ──────────────────

const CARWASH_CONFIG: IndustryConfig = {
  mainItems: [
    { key: "dashboard", href: "/dashboard",                       label: "Wash Overview",    icon: Droplets,      section: "MAIN" },
    { key: "issues",    href: "/issues?category=CUSTOMER_REPORT", label: "Customer Reports", icon: ClipboardList, section: "MAIN" },
    { key: "issues",    href: "/issues",                          label: "Issues",            icon: AlertCircle,   section: "MAIN" },
    { key: "issues",    href: "/issues?category=MAINTENANCE",     label: "Maintenance",       icon: Wrench,        section: "MAIN" },
  ],
  labelOverrides: {
    "/assets": "Equipment",
  },
}

const PROPERTY_CONFIG: IndustryConfig = {
  mainItems: [
    { key: "dashboard", href: "/dashboard",                         label: "Property Overview", icon: LayoutDashboard, section: "MAIN" },
    { key: "issues",    href: "/issues?category=TENANT_REQUEST",    label: "Tenant Requests",   icon: MessageSquare,   section: "MAIN" },
    { key: "issues",    href: "/issues",                            label: "Property Issues",   icon: AlertCircle,     section: "MAIN" },
    { key: "issues",    href: "/issues?category=MAINTENANCE",       label: "Maintenance",       icon: Wrench,          section: "MAIN" },
  ],
  labelOverrides: {
    "/assets":    "Equipment",
    "/locations": "Properties",
    "/vendors":   "Contractors",
  },
}

const MANUFACTURING_CONFIG: IndustryConfig = {
  mainItems: [
    { key: "dashboard", href: "/dashboard",                               label: "Plant Overview",  icon: LayoutDashboard, section: "MAIN" },
    { key: "issues",    href: "/issues?category=EQUIPMENT_BREAKDOWN",     label: "Equipment Issues", icon: Wrench,         section: "MAIN" },
    { key: "issues",    href: "/issues",                                  label: "Issues",           icon: AlertCircle,    section: "MAIN" },
    { key: "issues",    href: "/issues?category=SAFETY",                  label: "Safety Issues",    icon: HardHat,        section: "MAIN" },
  ],
  labelOverrides: {
    "/assets":    "Machines & Equipment",
    "/locations": "Plants & Areas",
    "/vendors":   "Suppliers",
  },
}

const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  "Car Wash":            CARWASH_CONFIG,
  "Property Management": PROPERTY_CONFIG,
  "Manufacturing":       MANUFACTURING_CONFIG,
}

// ── Section order used by industry navs ───────────────────────────────────────

export const INDUSTRY_SECTION_ORDER = [
  "MAIN",
  "OPERATIONS",
  "EMPLOYEE VOICE",
  "INTELLIGENCE",
  "ADMINISTRATION",
]

// ── buildNav — sidebar + mobile-nav call this for industry navs ───────────────

export function buildNav(
  industry: string,
  allowedSet: Set<PageKey>,
  featureFlags: { corporateDashboardEnabled?: boolean },
): NavItem[] {
  const config = INDUSTRY_CONFIGS[industry]
  if (!config) return []

  const overrides  = config.labelOverrides ?? {}
  const excluded   = new Set<PageKey>(config.excludedKeys ?? [])

  const mainItems = config.mainItems.filter(i => allowedSet.has(i.key))

  const masterItems = MASTER_NAV_ITEMS
    .filter(item => {
      if (!allowedSet.has(item.key)) return false
      if (excluded.has(item.key)) return false
      if (item.requiredFeatureFlag === "corporateDashboardEnabled" && !featureFlags.corporateDashboardEnabled) return false
      return true
    })
    .map(item => ({
      key:     item.key,
      href:    item.href,
      label:   overrides[item.href] ?? item.defaultLabel,
      icon:    item.icon,
      section: item.section,
    }))

  return [...mainItems, ...masterItems]
}

// ── getIndustryNavItems — full unfiltered list for settings/workspace UI ───────

export function getIndustryNavItems(industry: string): NavItem[] | null {
  const config = INDUSTRY_CONFIGS[industry]
  if (!config) return null
  const overrides = config.labelOverrides ?? {}
  const excluded  = new Set<PageKey>(config.excludedKeys ?? [])
  return [
    ...config.mainItems,
    ...MASTER_NAV_ITEMS
      .filter(i => !excluded.has(i.key))
      .map(i => ({
        key:     i.key,
        href:    i.href,
        label:   overrides[i.href] ?? i.defaultLabel,
        icon:    i.icon,
        section: i.section,
      })),
  ]
}

export function isIndustryNavFlat(industry: string): boolean {
  return !!INDUSTRY_CONFIGS[industry]
}

// ── Terminology resolution ────────────────────────────────────────────────────

export type TermKey =
  | "issueSingular"
  | "issuePlural"
  | "assetSingular"
  | "assetPlural"
  | "locationSingular"
  | "locationPlural"
  | "departmentSingular"
  | "departmentPlural"
  | "vendorSingular"
  | "vendorPlural"

export type TerminologyMap = Partial<Record<TermKey, string>>

export const PLATFORM_DEFAULTS: Record<TermKey, string> = {
  issueSingular:      "Issue",
  issuePlural:        "Issues",
  assetSingular:      "Asset",
  assetPlural:        "Assets",
  locationSingular:   "Location",
  locationPlural:     "Locations",
  departmentSingular: "Department",
  departmentPlural:   "Departments",
  vendorSingular:     "Vendor",
  vendorPlural:       "Vendors",
}

const INDUSTRY_TERMINOLOGY: Partial<Record<string, TerminologyMap>> = {
  "Car Wash": {
    assetSingular: "Equipment",
    assetPlural:   "Equipment",
  },
  "Property Management": {
    issueSingular:    "Work Order",
    issuePlural:      "Work Orders",
    assetSingular:    "Equipment",
    assetPlural:      "Equipment",
    locationSingular: "Property",
    locationPlural:   "Properties",
    vendorSingular:   "Contractor",
    vendorPlural:     "Contractors",
  },
  "Manufacturing": {
    assetSingular:    "Machine",
    assetPlural:      "Machines",
    locationSingular: "Plant",
    locationPlural:   "Plants",
    vendorSingular:   "Supplier",
    vendorPlural:     "Suppliers",
  },
}

export function resolveTerm(key: TermKey, industry: string, orgOverrides?: TerminologyMap): string {
  return orgOverrides?.[key] ?? INDUSTRY_TERMINOLOGY[industry]?.[key] ?? PLATFORM_DEFAULTS[key]
}
