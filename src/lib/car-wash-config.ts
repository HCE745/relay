// Car-wash operational taxonomy — drives asset subtype constraints on Wash Essentials.
// This covers the full legitimate operational scope of a 1–7 location car wash.

export const CARWASH_ASSET_TAXONOMY: Record<string, string> = {
  // Wash bays / tunnel
  SELF_SERVICE_BAY:   "Self-Service Bay",
  AUTOMATIC_BAY:      "Automatic Bay",
  TUNNEL_EQUIPMENT:   "Tunnel Equipment",
  CONVEYOR:           "Conveyor",
  DRYER:              "Dryer",
  // Customer-facing equipment
  VACUUM:             "Vacuum",
  PAY_STATION:        "Pay Station",
  CHANGER:            "Bill Changer",
  VENDING:            "Vending Machine",
  AIR_MACHINE:        "Air Machine",
  KIOSK:              "Kiosk / Self-Service Terminal",
  // Mechanical systems
  PUMP:               "Pump",
  COMPRESSOR:         "Compressor",
  BOILER:             "Boiler",
  RO_SYSTEM:          "RO / Water System",
  CHEMICAL_SYSTEM:    "Chemical Dosing System",
  WATER_TREATMENT:    "Water Treatment",
  // Site / facility assets
  DOOR:               "Bay Door / Gate",
  BUILDING:           "Building / Facility Structure",
  LIGHTING:           "Lighting",
  SIGN:               "Sign / Display",
  PLUMBING:           "Plumbing",
  HVAC:               "HVAC",
  SECURITY:           "Security System / Camera",
  // Operational
  TOOL:               "Tool / Hand Equipment",
  VEHICLE:            "Maintenance Vehicle",
  GROUNDS:            "Grounds / Landscaping",
  OTHER:              "Other",
} as const

export type CarwashAssetSubtype = keyof typeof CARWASH_ASSET_TAXONOMY

export const CARWASH_ASSET_SUBTYPES = Object.keys(CARWASH_ASSET_TAXONOMY) as CarwashAssetSubtype[]

// Issue categories available to car-wash orgs (superset of normal allowed set)
export const CARWASH_ISSUE_CATEGORIES = [
  "EQUIPMENT_BREAKDOWN",
  "MAINTENANCE",
  "SAFETY",
  "FACILITY",
  "VEHICLE",
  "EMPLOYEE",
  "GENERAL",
  "CUSTOMER_COMPLAINT",
  "CUSTOMER_REPORT",   // QR-submitted anonymous customer report
  "SUPPLY_SHORTAGE",
] as const

// Friendly labels for QR report form (customer-facing)
export const CARWASH_QR_PROBLEM_LABELS: Record<string, string> = {
  EQUIPMENT_BREAKDOWN: "Not Working / Broken",
  MAINTENANCE:         "Needs Cleaning / Maintenance",
  SAFETY:              "Safety Issue / Hazard",
  CUSTOMER_COMPLAINT:  "Payment / Billing Issue",
  CUSTOMER_REPORT:     "Something Else",
  SUPPLY_SHORTAGE:     "Needs Supplies (soap, tokens, etc.)",
}

// Default QR categories for car-wash customer-facing codes
export const CARWASH_QR_DEFAULT_CATEGORIES = [
  "EQUIPMENT_BREAKDOWN",
  "MAINTENANCE",
  "SAFETY",
  "SUPPLY_SHORTAGE",
  "CUSTOMER_REPORT",
]

// Features blocked on Wash Essentials regardless of feature flags — prevents
// repurposing as generic Relay. This matches the WashEssentialsBlock type in pricing.ts.
export const WASH_ESSENTIALS_BLOCKED_PATHS = [
  "/departments",
  "/sops",
  "/analytics/cross-location",
  "/approval-intelligence",
  "/settings/api-keys",
  "/settings/webhooks",
  "/regions",
  "/corporate",
  "/executive-briefings",
] as const

// Default PM schedule titles for car-wash onboarding quick-setup
export const CARWASH_DEFAULT_PM_SCHEDULES = [
  { title: "Weekly vacuum filter inspection",       recurrence: "weekly" as const  },
  { title: "Monthly pump lubrication — all bays",  recurrence: "monthly" as const },
  { title: "Monthly pay station audit",            recurrence: "monthly" as const },
  { title: "Quarterly RO membrane inspection",     recurrence: "quarterly" as const },
  { title: "Quarterly chemical system calibration",recurrence: "quarterly" as const },
] as const
