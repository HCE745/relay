// Shared constants — safe to import from both client and server components

export type SuggestionCategory =
  | "SAFETY"
  | "MAINTENANCE"
  | "HR"
  | "PROCESS"
  | "FACILITY"
  | "SUPPLY"
  | "CUSTOMER"
  | "GENERAL"

export const SUGGESTION_CATEGORY_LABEL: Record<string, string> = {
  SAFETY: "Safety & Compliance",
  MAINTENANCE: "Maintenance & Equipment",
  HR: "HR & People",
  PROCESS: "Process & Efficiency",
  FACILITY: "Facility & Space",
  SUPPLY: "Supply & Inventory",
  CUSTOMER: "Customer Service",
  GENERAL: "General",
}
