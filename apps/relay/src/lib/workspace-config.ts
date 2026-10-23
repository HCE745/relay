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

// ── Nav item type ────────────────────────────────────────────────────────────

export interface NavItem {
  key: PageKey
  href: string
  label: string
  icon: ElementType
  section?: string
}

// ── Industry nav arrays (flat) ────────────────────────────────────────────────

export const CARWASH_NAV_ITEMS: NavItem[] = [
  { key: "dashboard",              href: "/dashboard",                       label: "Wash Overview",          icon: Droplets       },
  { key: "issues",                 href: "/issues?category=CUSTOMER_REPORT", label: "Customer Reports",       icon: ClipboardList  },
  { key: "issues",                 href: "/issues",                          label: "Issues",                 icon: AlertCircle    },
  { key: "issues",                 href: "/issues?category=MAINTENANCE",     label: "Maintenance",            icon: Wrench         },
  { key: "assignments",            href: "/assignments",                     label: "Assignments",            icon: ClipboardCheck },
  { key: "communications",         href: "/communications",                  label: "Communications",         icon: Radio          },
  { key: "assets",                 href: "/assets",                          label: "Equipment",              icon: Package        },
  { key: "qr-codes",               href: "/qr-codes",                        label: "QR Codes",               icon: QrCode         },
  { key: "locations",              href: "/locations",                       label: "Locations",              icon: MapPin         },
  { key: "departments",            href: "/departments",                     label: "Departments",            icon: Building2      },
  { key: "vendors",                href: "/vendors",                         label: "Vendors",                icon: Building2      },
  { key: "sops",                   href: "/sops",                            label: "SOPs",                   icon: BookOpen       },
  { key: "calendar",               href: "/calendar",                        label: "Calendar",               icon: CalendarDays   },
  { key: "purchase-requests",      href: "/purchase-requests",               label: "Purchase Requests",      icon: ShoppingCart   },
  { key: "approval-intelligence",  href: "/approval-intelligence",           label: "Approval Intelligence",  icon: CheckSquare    },
  { key: "my-submissions",         href: "/my-submissions",                  label: "My Submissions",         icon: ClipboardList  },
  { key: "archive",                href: "/archive",                         label: "Archive",                icon: Archive        },
  { key: "voice",                  href: "/voice",                           label: "Employee Voice",         icon: Megaphone      },
  { key: "suggestions",            href: "/suggestions",                     label: "Suggestions",            icon: Lightbulb      },
  { key: "surveys",                href: "/surveys",                         label: "Surveys",                icon: ClipboardList  },
  { key: "recognition",            href: "/recognition",                     label: "Recognition",            icon: Award          },
  { key: "team",                   href: "/team",                            label: "Team",                   icon: Users          },
  { key: "analytics",              href: "/analytics",                       label: "Reports",                icon: BarChart2      },
  { key: "analytics-dashboard",    href: "/analytics/dashboard",             label: "Dashboard",              icon: LayoutGrid     },
  { key: "corporate-dashboard",    href: "/corporate-dashboard",             label: "Corporate View",         icon: Globe2         },
  { key: "regional-dashboard",     href: "/regional-dashboard",              label: "Regional View",          icon: Building       },
]

export const PROPERTY_NAV_ITEMS: NavItem[] = [
  { key: "dashboard",              href: "/dashboard",                          label: "Property Overview",      icon: LayoutDashboard },
  { key: "issues",                 href: "/issues?category=TENANT_REQUEST",     label: "Tenant Requests",        icon: MessageSquare  },
  { key: "issues",                 href: "/issues",                             label: "Property Issues",        icon: AlertCircle    },
  { key: "issues",                 href: "/issues?category=MAINTENANCE",        label: "Maintenance",            icon: Wrench         },
  { key: "assignments",            href: "/assignments",                        label: "Assignments",            icon: ClipboardCheck },
  { key: "communications",         href: "/communications",                     label: "Communications",         icon: Radio          },
  { key: "assets",                 href: "/assets",                             label: "Equipment",              icon: Package        },
  { key: "locations",              href: "/locations",                          label: "Properties",             icon: MapPin         },
  { key: "qr-codes",               href: "/qr-codes",                           label: "QR Codes",               icon: QrCode         },
  { key: "departments",            href: "/departments",                        label: "Departments",            icon: Building2      },
  { key: "vendors",                href: "/vendors",                            label: "Contractors",            icon: HardHat        },
  { key: "sops",                   href: "/sops",                               label: "SOPs",                   icon: BookOpen       },
  { key: "calendar",               href: "/calendar",                           label: "Calendar",               icon: CalendarDays   },
  { key: "purchase-requests",      href: "/purchase-requests",                  label: "Purchase Requests",      icon: ShoppingCart   },
  { key: "approval-intelligence",  href: "/approval-intelligence",              label: "Approval Intelligence",  icon: CheckSquare    },
  { key: "my-submissions",         href: "/my-submissions",                     label: "My Submissions",         icon: ClipboardList  },
  { key: "archive",                href: "/archive",                            label: "Archive",                icon: Archive        },
  { key: "voice",                  href: "/voice",                              label: "Employee Voice",         icon: Megaphone      },
  { key: "suggestions",            href: "/suggestions",                        label: "Suggestions",            icon: Lightbulb      },
  { key: "surveys",                href: "/surveys",                            label: "Surveys",                icon: ClipboardList  },
  { key: "recognition",            href: "/recognition",                        label: "Recognition",            icon: Award          },
  { key: "team",                   href: "/team",                               label: "Team",                   icon: Users          },
  { key: "analytics",              href: "/analytics",                          label: "Reports",                icon: BarChart2      },
  { key: "analytics-dashboard",    href: "/analytics/dashboard",                label: "Dashboard",              icon: LayoutGrid     },
  { key: "corporate-dashboard",    href: "/corporate-dashboard",                label: "Corporate View",         icon: Globe2         },
  { key: "regional-dashboard",     href: "/regional-dashboard",                 label: "Regional View",          icon: Building       },
]

export const MANUFACTURING_NAV_ITEMS: NavItem[] = [
  { key: "dashboard",              href: "/dashboard",                               label: "Plant Overview",         icon: LayoutDashboard },
  { key: "issues",                 href: "/issues?category=EQUIPMENT_BREAKDOWN",     label: "Equipment Issues",       icon: Wrench         },
  { key: "issues",                 href: "/issues",                                  label: "Issues",                 icon: AlertCircle    },
  { key: "issues",                 href: "/issues?category=SAFETY",                  label: "Safety Issues",          icon: HardHat        },
  { key: "assignments",            href: "/assignments",                             label: "Assignments",            icon: ClipboardCheck },
  { key: "communications",         href: "/communications",                          label: "Communications",         icon: Radio          },
  { key: "assets",                 href: "/assets",                                  label: "Machines & Equipment",   icon: Package        },
  { key: "locations",              href: "/locations",                               label: "Plants & Areas",         icon: MapPin         },
  { key: "departments",            href: "/departments",                             label: "Departments",            icon: Building2      },
  { key: "vendors",                href: "/vendors",                                 label: "Suppliers",              icon: Building2      },
  { key: "qr-codes",               href: "/qr-codes",                                label: "QR Codes",               icon: QrCode         },
  { key: "sops",                   href: "/sops",                                    label: "SOPs",                   icon: BookOpen       },
  { key: "calendar",               href: "/calendar",                                label: "Calendar",               icon: CalendarDays   },
  { key: "purchase-requests",      href: "/purchase-requests",                       label: "Purchase Requests",      icon: ShoppingCart   },
  { key: "approval-intelligence",  href: "/approval-intelligence",                   label: "Approval Intelligence",  icon: CheckSquare    },
  { key: "my-submissions",         href: "/my-submissions",                          label: "My Submissions",         icon: ClipboardList  },
  { key: "archive",                href: "/archive",                                 label: "Archive",                icon: Archive        },
  { key: "voice",                  href: "/voice",                                   label: "Employee Voice",         icon: Megaphone      },
  { key: "suggestions",            href: "/suggestions",                             label: "Suggestions",            icon: Lightbulb      },
  { key: "surveys",                href: "/surveys",                                 label: "Surveys",                icon: ClipboardList  },
  { key: "recognition",            href: "/recognition",                             label: "Recognition",            icon: Award          },
  { key: "team",                   href: "/team",                                    label: "Team",                   icon: Users          },
  { key: "analytics",              href: "/analytics",                               label: "Reports",                icon: BarChart2      },
  { key: "analytics-dashboard",    href: "/analytics/dashboard",                     label: "Dashboard",              icon: LayoutGrid     },
  { key: "corporate-dashboard",    href: "/corporate-dashboard",                     label: "Corporate View",         icon: Globe2         },
  { key: "regional-dashboard",     href: "/regional-dashboard",                      label: "Regional View",          icon: Building       },
]

// ── Industry dispatch ─────────────────────────────────────────────────────────

export function getIndustryNavItems(industry: string): NavItem[] | null {
  switch (industry) {
    case "Car Wash":            return CARWASH_NAV_ITEMS
    case "Property Management": return PROPERTY_NAV_ITEMS
    case "Manufacturing":       return MANUFACTURING_NAV_ITEMS
    default:                    return null
  }
}

export function isIndustryNavFlat(industry: string): boolean {
  return industry === "Car Wash" || industry === "Property Management" || industry === "Manufacturing"
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
