// Manufacturing Edition — industry-specific configuration
// Asset taxonomy, issue categories, QR operator labels, and terminology

// ── Asset taxonomy ────────────────────────────────────────────────────────────

export const MFG_ASSET_TAXONOMY: Record<string, string> = {
  // Machining
  CNC_MILL:           "CNC Mill",
  CNC_LATHE:          "CNC Lathe",
  BRAKE_PRESS:        "Brake Press",
  LASER_CUTTER:       "Laser Cutter",
  PLASMA_CUTTER:      "Plasma Cutter",
  WATERJET:           "Waterjet Cutter",
  SAW:                "Industrial Saw",
  GRINDER:            "Grinder",

  // Fabrication & Assembly
  WELDER:             "Welder",
  ROBOT:              "Welding / Assembly Robot",
  CONVEYOR:           "Conveyor System",
  ASSEMBLY_STATION:   "Assembly Station",
  PACKAGING_MACHINE:  "Packaging Machine",
  INJECTION_MOLDING:  "Injection Molding Press",
  EXTRUSION:          "Extrusion Machine",
  FURNACE_OVEN:       "Furnace / Oven",

  // Utilities & Support
  COMPRESSOR:         "Air Compressor",
  BOILER:             "Boiler",
  CHILLER:            "Chiller",
  HVAC:               "HVAC Unit",
  DUST_COLLECTION:    "Dust Collector",
  ELECTRICAL_PANEL:   "Electrical Panel",
  AIR_SYSTEM:         "Compressed Air System",
  WATER_SYSTEM:       "Water System",

  // Material Handling
  DOCK_EQUIPMENT:     "Dock Equipment",
  FORKLIFT:           "Forklift",
  CRANE:              "Overhead Crane",
  HOIST:              "Hoist",
  PALLET_JACK:        "Pallet Jack",

  // Quality & Inspection
  CMM:                "Coordinate Measuring Machine (CMM)",
  INSPECTION_EQUIPMENT: "Inspection Equipment",
  GAUGE:              "Gauge / Measuring Instrument",
  FIXTURE:            "Fixture / Jig",

  // Tooling & Dies
  DIE:                "Die",
  MOLD:               "Mold",
  TOOLING:            "Tooling / Cutting Tools",

  // Facility & Safety
  FACILITY:           "Facility / Building System",
  VEHICLE:            "Vehicle",
  SAFETY_EQUIPMENT:   "Safety Equipment",

  OTHER_MFG:          "Other Equipment",
}

// ── Issue categories ──────────────────────────────────────────────────────────

export const MFG_ISSUE_CATEGORIES = [
  "EQUIPMENT_BREAKDOWN",
  "MAINTENANCE",
  "QUALITY",
  "SAFETY",
  "MATERIAL_SHORTAGE",
  "TOOLING",
  "ENGINEERING",
  "SUPPLIER",
  "PROCESS",
  "VEHICLE",
  "FACILITY",
  "GENERAL",
] as const

export type MfgIssueCategory = typeof MFG_ISSUE_CATEGORIES[number]

export const MFG_CATEGORY_LABELS: Record<string, string> = {
  EQUIPMENT_BREAKDOWN: "Equipment Breakdown",
  MAINTENANCE:         "Maintenance",
  QUALITY:             "Quality",
  SAFETY:              "Safety",
  MATERIAL_SHORTAGE:   "Material Shortage",
  TOOLING:             "Tooling",
  ENGINEERING:         "Engineering",
  SUPPLIER:            "Supplier Issue",
  PROCESS:             "Process",
  VEHICLE:             "Vehicle",
  FACILITY:            "Facility",
  GENERAL:             "General",
}

// ── QR operator-facing problem labels ────────────────────────────────────────

export const MFG_QR_PROBLEM_LABELS = [
  "Machine not running",
  "Strange noise or vibration",
  "Quality / defect issue",
  "Safety hazard",
  "Material shortage",
  "Tooling problem",
  "Leak (fluid, air, or coolant)",
  "Other / unsure",
] as const

export const MFG_QR_DEFAULT_CATEGORIES: Record<string, string> = {
  "Machine not running":      "EQUIPMENT_BREAKDOWN",
  "Strange noise or vibration": "MAINTENANCE",
  "Quality / defect issue":   "QUALITY",
  "Safety hazard":            "SAFETY",
  "Material shortage":        "MATERIAL_SHORTAGE",
  "Tooling problem":          "TOOLING",
  "Leak (fluid, air, or coolant)": "MAINTENANCE",
  "Other / unsure":           "GENERAL",
}

// ── Terminology ───────────────────────────────────────────────────────────────

export const MANUFACTURING_TERMINOLOGY = {
  issueSingular:      "Issue",
  issuePlural:        "Issues",
  assetSingular:      "Machine",
  assetPlural:        "Machines",
  locationSingular:   "Plant",
  locationPlural:     "Plants",
  departmentSingular: "Department",
  departmentPlural:   "Departments",
  vendorSingular:     "Supplier",
  vendorPlural:       "Suppliers",
}
