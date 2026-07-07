export const ISSUE_STATUS = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ESCALATED: "Escalated",
  PENDING_VENDOR: "Pending Vendor",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
} as const

export const ISSUE_PRIORITY = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
} as const

export const ISSUE_CATEGORY = {
  INJURY:              "Injury",
  EQUIPMENT_BREAKDOWN: "Equipment Breakdown",
  MAINTENANCE:         "Maintenance",
  SAFETY:              "Safety",
  SUPPLY_SHORTAGE:     "Supply Shortage",
  CUSTOMER_COMPLAINT:  "Customer Complaint",
  FACILITY:            "Facility",
  VEHICLE:             "Vehicle",
  EMPLOYEE:            "Employee",
  GENERAL:             "General",
} as const

export const INJURY_SEVERITY = {
  MINOR:    "Minor / First Aid",
  MODERATE: "Moderate",
  SEVERE:   "Severe / Emergency",
} as const

export const ASSET_TYPE = {
  EQUIPMENT: "Equipment",
  VEHICLE: "Vehicle",
  FACILITY: "Facility",
  TOOL: "Tool",
  TECHNOLOGY: "Technology",
  OTHER: "Other",
} as const

export const ASSET_STATUS = {
  OPERATIONAL: "Operational",
  MAINTENANCE: "Under Maintenance",
  OUT_OF_SERVICE: "Out of Service",
  RETIRED: "Retired",
} as const

export const USER_ROLE = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee",
  VENDOR: "Vendor",
  HR: "HR",
} as const

export const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-green-100 text-green-800 border-green-200",
}

export const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-purple-100 text-purple-800 border-purple-200",
  ESCALATED: "bg-red-100 text-red-800 border-red-200",
  PENDING_VENDOR: "bg-orange-100 text-orange-800 border-orange-200",
  RESOLVED: "bg-green-100 text-green-800 border-green-200",
  CLOSED: "bg-gray-100 text-gray-800 border-gray-200",
}

export const ASSET_STATUS_COLOR: Record<string, string> = {
  OPERATIONAL: "bg-green-100 text-green-800",
  MAINTENANCE: "bg-yellow-100 text-yellow-800",
  OUT_OF_SERVICE: "bg-red-100 text-red-800",
  RETIRED: "bg-gray-100 text-gray-800",
}
