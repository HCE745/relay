// Property Management industry configuration — drives asset taxonomy, QR labels,
// terminology overrides, and default PM schedules for Property Management orgs.

export const PM_ASSET_TAXONOMY: Record<string, string> = {
  // Building systems
  HVAC_UNIT:          "HVAC Unit",
  BOILER:             "Boiler",
  WATER_HEATER:       "Water Heater",
  ELECTRICAL_PANEL:   "Electrical Panel",
  GENERATOR:          "Emergency Generator",
  FIRE_SUPPRESSION:   "Fire Suppression System",
  ROOF_SYSTEM:        "Roof System",
  PLUMBING:           "Plumbing / Drain",
  // Access & security
  ELEVATOR:           "Elevator / Lift",
  ACCESS_CONTROL:     "Access Control / Key System",
  SECURITY_CAMERA:    "Security Camera",
  INTERCOM:           "Intercom / Call Box",
  PARKING_GATE:       "Parking Gate / Barrier",
  EXTERIOR_LIGHTING:  "Exterior Lighting",
  // Property assets
  POOL_SPA:           "Pool / Spa System",
  LAUNDRY_EQUIPMENT:  "Laundry Equipment",
  COMMON_AREA:        "Common Area / Amenity",
  LANDSCAPING:        "Landscaping / Grounds",
  APPLIANCE:          "Unit Appliance",
  VEHICLE:            "Property Vehicle",
  OTHER:              "Other",
} as const

export type PropertyAssetSubtype = keyof typeof PM_ASSET_TAXONOMY

export const PM_ASSET_SUBTYPES = Object.keys(PM_ASSET_TAXONOMY) as PropertyAssetSubtype[]

// Issue categories available to Property Management orgs
export const PM_ISSUE_CATEGORIES = [
  "MAINTENANCE",
  "FACILITY",
  "SAFETY",
  "TENANT_REQUEST",
  "EQUIPMENT_BREAKDOWN",
  "EMPLOYEE",
  "GENERAL",
] as const

// Friendly labels for QR report form (tenant-facing)
export const PM_QR_PROBLEM_LABELS: Record<string, string> = {
  MAINTENANCE:         "Maintenance Needed",
  FACILITY:            "Building / Common Area Issue",
  SAFETY:              "Safety Concern",
  TENANT_REQUEST:      "Service Request",
  EQUIPMENT_BREAKDOWN: "Not Working / Broken",
  GENERAL:             "General Feedback",
}

// Default QR categories for property management tenant-facing codes
export const PM_QR_DEFAULT_CATEGORIES = [
  "TENANT_REQUEST",
  "MAINTENANCE",
  "FACILITY",
  "SAFETY",
]

// Default maintenance schedule titles for property management orgs
export const PM_DEFAULT_PM_SCHEDULES = [
  { title: "Monthly HVAC filter inspection",            recurrence: "monthly"    as const },
  { title: "Quarterly roof drain inspection",           recurrence: "quarterly"  as const },
  { title: "Annual fire suppression system test",       recurrence: "yearly"     as const },
  { title: "Semi-annual elevator safety inspection",    recurrence: "monthly"    as const },
  { title: "Monthly exterior lighting walkthrough",     recurrence: "monthly"    as const },
] as const

// Terminology overrides for Property Management (generic label → PM label).
// Issues are NOT renamed globally — only nav labels provide context-specific names.
export const propertyManagementTerminology: Record<string, string> = {
  Assets:          "Equipment",
  Asset:           "Equipment",
  "Asset History": "Equipment Service History",
  Locations:       "Properties",
  Location:        "Property",
  "Add Asset":     "Add Equipment",
}

// User-facing labels for Property Management issue categories
export const propertyManagementIssueLabels: Record<string, string> = {
  MAINTENANCE:         "Maintenance",
  TENANT_REQUEST:      "Tenant Request",
  EQUIPMENT_BREAKDOWN: "Equipment Failure",
  SAFETY:              "Safety",
  FACILITY:            "Building Issue",
  EMPLOYEE:            "Employee",
  GENERAL:             "General",
}
